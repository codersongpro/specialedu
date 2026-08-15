'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { isoDayOfWeek, shiftDays } from '@/lib/date'
import { getCurrentTerm } from '@/lib/data/context'
import { AUDIT_ACTIONS, writeAudit } from '@/lib/security/audit'
import { createClient, isAdmin, requireSession } from '@/lib/supabase/server'

const AbsenceInput = z.object({
  teacherId: z.string().uuid(),
  startsOn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  endsOn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  reason: z.enum(['business_trip', 'sick', 'annual', 'training', 'official', 'other']),
  note: z.string().max(300).optional(),
})

export interface AbsenceState {
  error?: string
  created?: number
}

/**
 * 결과 신청.
 *
 * 신청과 동시에 그 기간에 걸린 수업을 시간표에서 뽑아 결보강 대상으로 만든다.
 * 교사가 "몇 교시가 비는지" 손으로 세는 일을 없애는 게 이 기능의 핵심이다.
 */
export async function createAbsence(
  _prev: AbsenceState,
  formData: FormData,
): Promise<AbsenceState> {
  const session = await requireSession()

  const parsed = AbsenceInput.safeParse({
    teacherId: formData.get('teacherId'),
    startsOn: formData.get('startsOn'),
    endsOn: formData.get('endsOn'),
    reason: formData.get('reason'),
    note: formData.get('note') || undefined,
  })

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? '입력을 확인하세요' }
  }
  const input = parsed.data

  if (input.endsOn < input.startsOn) {
    return { error: '끝나는 날이 시작일보다 빠릅니다' }
  }
  // 본인 것이거나 관리자만
  if (input.teacherId !== session.userId && !isAdmin(session.profile)) {
    return { error: '다른 선생님의 결과는 관리자만 넣을 수 있습니다' }
  }

  const supabase = await createClient()
  const term = await getCurrentTerm(supabase, session.school.id)
  if (!term) return { error: '학기가 등록되지 않았습니다' }

  const { data: absence, error: absenceError } = await supabase
    .from('absences')
    .insert({
      school_id: session.school.id,
      teacher_id: input.teacherId,
      starts_on: input.startsOn,
      ends_on: input.endsOn,
      reason: input.reason,
      note: input.note ?? null,
      created_by: session.userId,
    })
    .select('id')
    .single()

  if (absenceError || !absence) {
    return { error: '저장하지 못했습니다' }
  }

  // 결과 기간에 걸린 수업을 날짜별로 펼친다
  const { data: slots } = await supabase
    .from('timetable_slots')
    .select('*')
    .eq('term_id', term.id)
    .or(`teacher_id.eq.${input.teacherId},co_teacher_id.eq.${input.teacherId}`)

  const rows: Array<Record<string, unknown>> = []
  for (let date = input.startsOn; date <= input.endsOn; date = shiftDays(date, 1)) {
    const dayOfWeek = isoDayOfWeek(date)
    if (dayOfWeek > 5) continue // 주말은 건너뛴다

    for (const slot of slots ?? []) {
      if (slot.day_of_week !== dayOfWeek) continue
      rows.push({
        school_id: session.school.id,
        absence_id: absence.id,
        assign_date: date,
        course: slot.course,
        period_no: slot.period_no,
        timetable_slot_id: slot.id,
        class_id: slot.class_id,
        course_group_id: slot.course_group_id,
        subject_id: slot.subject_id,
        room_id: slot.room_id,
        status: 'pending',
      })
    }
  }

  if (rows.length > 0) {
    await supabase.from('substitution_assignments').insert(rows as never)
  }

  await writeAudit({
    schoolId: session.school.id,
    actorId: session.userId,
    actorName: session.profile.name,
    action: AUDIT_ACTIONS.absenceCreate,
    targetTable: 'absences',
    targetId: absence.id,
    meta: { from: input.startsOn, to: input.endsOn, lessons: rows.length },
  })

  revalidatePath('/substitutions')
  return { created: rows.length }
}

export async function assignSubstitute(formData: FormData): Promise<void> {
  const session = await requireSession()
  if (!isAdmin(session.profile)) return

  const assignmentId = String(formData.get('assignmentId') ?? '')
  const teacherId = String(formData.get('teacherId') ?? '')
  const score = Number(formData.get('score') ?? 0)
  const isPaid = formData.get('isPaid') === '1'
  if (!assignmentId || !teacherId) return

  const supabase = await createClient()
  const { error } = await supabase
    .from('substitution_assignments')
    .update({
      assigned_teacher_id: teacherId,
      status: 'assigned',
      score: Number.isFinite(score) ? score : null,
      is_paid: isPaid,
      assigned_by: session.userId,
      assigned_at: new Date().toISOString(),
    })
    .eq('id', assignmentId)

  if (!error) {
    await writeAudit({
      schoolId: session.school.id,
      actorId: session.userId,
      actorName: session.profile.name,
      action: AUDIT_ACTIONS.substitutionAssign,
      targetTable: 'substitution_assignments',
      targetId: assignmentId,
      meta: { teacherId, score },
    })
  }

  revalidatePath('/substitutions')
}

export async function clearAssignment(formData: FormData): Promise<void> {
  const session = await requireSession()
  if (!isAdmin(session.profile)) return

  const assignmentId = String(formData.get('assignmentId') ?? '')
  if (!assignmentId) return

  const supabase = await createClient()
  await supabase
    .from('substitution_assignments')
    .update({
      assigned_teacher_id: null,
      status: 'pending',
      score: null,
      is_paid: false,
      assigned_by: null,
      assigned_at: null,
    })
    .eq('id', assignmentId)

  revalidatePath('/substitutions')
}
