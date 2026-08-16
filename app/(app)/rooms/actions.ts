'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { findConflicts, hasBlocking } from '@/lib/scheduling/conflicts'
import { formatKoreanDate, isoDayOfWeek } from '@/lib/date'
import { getCurrentTerm, loadScheduleContext } from '@/lib/data/context'
import { notify } from '@/lib/notifications'
import { AUDIT_ACTIONS, writeAudit } from '@/lib/security/audit'
import { createClient, isAdmin, requireSession } from '@/lib/supabase/server'

const CreateInput = z.object({
  roomId: z.string().uuid(),
  reservedDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  course: z.enum(['elementary', 'middle', 'high', 'vocational']),
  periodNo: z.coerce.number().int().min(0).max(15),
  classId: z.string().uuid().nullable(),
  courseGroupId: z.string().uuid().nullable(),
  coTeacherId: z.string().uuid().nullable(),
  kind: z.enum(['regular', 'onetime', 'afterschool', 'vocational_practice', 'co_teaching']),
  purpose: z.string().max(200).nullable(),
})

export interface ReservationState {
  error?: string
  conflicts?: string[]
  ok?: boolean
}

/**
 * 예약 만들기.
 *
 * 화면에서도 같은 함수로 충돌을 검사하지만, 여기서 반드시 다시 본다.
 * 클라이언트가 보낸 판정을 믿으면 아무 의미가 없다.
 */
export async function createReservation(
  _prev: ReservationState,
  formData: FormData,
): Promise<ReservationState> {
  const session = await requireSession()

  const parsed = CreateInput.safeParse({
    roomId: formData.get('roomId'),
    reservedDate: formData.get('reservedDate'),
    course: formData.get('course'),
    periodNo: formData.get('periodNo'),
    classId: emptyToNull(formData.get('classId')),
    courseGroupId: emptyToNull(formData.get('courseGroupId')),
    coTeacherId: emptyToNull(formData.get('coTeacherId')),
    kind: formData.get('kind'),
    purpose: emptyToNull(formData.get('purpose')),
  })

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? '입력을 확인하세요' }
  }
  const input = parsed.data

  if (!input.classId && !input.courseGroupId) {
    return { error: '어느 학급 수업인지 골라 주세요' }
  }

  const supabase = await createClient()
  const term = await getCurrentTerm(supabase, session.school.id)
  if (!term) return { error: '학기가 등록되지 않았습니다. 관리자에게 문의하세요.' }

  const ctx = await loadScheduleContext(supabase, {
    schoolId: session.school.id,
    termId: term.id,
    fromDate: input.reservedDate,
    toDate: input.reservedDate,
  })

  const period = ctx.periods.find(
    (p) => p.course === input.course && p.period_no === input.periodNo,
  )
  if (!period) return { error: '시정표에 없는 교시입니다' }

  const conflicts = findConflicts(
    {
      roomId: input.roomId,
      reservedDate: input.reservedDate,
      dayOfWeek: isoDayOfWeek(input.reservedDate),
      course: input.course,
      periodNo: input.periodNo,
      startsMin: period.starts_min,
      endsMin: period.ends_min,
      classId: input.classId,
      courseGroupId: input.courseGroupId,
      requesterId: session.userId,
      coTeacherId: input.coTeacherId,
      kind: input.kind,
    },
    ctx,
  )

  if (hasBlocking(conflicts)) {
    return {
      error: '겹치는 일정이 있어 예약할 수 없습니다',
      conflicts: conflicts.filter((c) => c.severity === 'block').map((c) => c.message),
    }
  }

  const room = ctx.rooms.get(input.roomId)
  // 승인이 필요한 특별실은 대기 상태로 들어간다.
  // 관리자가 직접 잡는 건 바로 확정한다.
  const status = room?.requiresApproval && !isAdmin(session.profile) ? 'pending' : 'approved'

  const { error } = await supabase.from('room_reservations').insert({
    school_id: session.school.id,
    room_id: input.roomId,
    reserved_date: input.reservedDate,
    course: input.course,
    period_no: input.periodNo,
    class_id: input.classId,
    course_group_id: input.courseGroupId,
    requester_id: session.userId,
    co_teacher_id: input.coTeacherId,
    kind: input.kind,
    status,
    purpose: input.purpose,
  })

  if (error) {
    // DB 의 EXCLUDE 제약에 걸린 경우 — 검사와 저장 사이에 누가 먼저 잡았다는 뜻이다
    if (error.code === '23P01') {
      return { error: '방금 다른 분이 같은 시간을 예약했습니다. 새로고침 후 다시 시도하세요.' }
    }
    return { error: '저장하지 못했습니다. 잠시 후 다시 시도하세요.' }
  }

  await writeAudit({
    schoolId: session.school.id,
    actorId: session.userId,
    actorName: session.profile.name,
    action: AUDIT_ACTIONS.reservationCreate,
    targetTable: 'room_reservations',
    meta: { room: room?.name, date: input.reservedDate, period: input.periodNo },
  })

  revalidatePath('/rooms')
  return { ok: true }
}

export async function cancelReservation(formData: FormData): Promise<void> {
  const session = await requireSession()
  const id = String(formData.get('id') ?? '')
  if (!id) return

  const supabase = await createClient()
  // RLS 가 본인 예약 또는 관리자만 통과시킨다.
  const { error } = await supabase
    .from('room_reservations')
    .update({ status: 'cancelled' })
    .eq('id', id)

  if (!error) {
    await writeAudit({
      schoolId: session.school.id,
      actorId: session.userId,
      actorName: session.profile.name,
      action: AUDIT_ACTIONS.reservationCancel,
      targetTable: 'room_reservations',
      targetId: id,
    })
  }

  revalidatePath('/rooms')
}

export async function approveReservation(formData: FormData): Promise<void> {
  const session = await requireSession()
  if (!isAdmin(session.profile)) return

  const id = String(formData.get('id') ?? '')
  const decision = String(formData.get('decision') ?? '')
  if (!id || !['approved', 'rejected'].includes(decision)) return

  const supabase = await createClient()
  const { data: updated } = await supabase
    .from('room_reservations')
    .update({
      status: decision as 'approved' | 'rejected',
      approved_by: session.userId,
      approved_at: new Date().toISOString(),
    })
    .eq('id', id)
    .select('requester_id, reserved_date, room_id')
    .single()

  await writeAudit({
    schoolId: session.school.id,
    actorId: session.userId,
    actorName: session.profile.name,
    action: AUDIT_ACTIONS.reservationApprove,
    targetTable: 'room_reservations',
    targetId: id,
    meta: { decision },
  })

  if (updated) {
    const { data: room } = await supabase.from('rooms').select('name').eq('id', updated.room_id).maybeSingle()
    await notify({
      schoolId: session.school.id,
      profileId: updated.requester_id,
      title: decision === 'approved' ? '특별실 예약이 승인되었습니다' : '특별실 예약이 반려되었습니다',
      body: `${room?.name ?? '특별실'} · ${formatKoreanDate(updated.reserved_date)}`,
      link: '/rooms',
    })
  }

  revalidatePath('/rooms')
}

function emptyToNull(value: FormDataEntryValue | null): string | null {
  const text = typeof value === 'string' ? value.trim() : ''
  return text === '' ? null : text
}
