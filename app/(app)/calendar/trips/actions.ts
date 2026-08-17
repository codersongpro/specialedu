'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { AUDIT_ACTIONS, writeAudit } from '@/lib/security/audit'
import { createClient, requireSession } from '@/lib/supabase/server'

const PATH = '/calendar/trips'

export interface SimpleResult {
  ok?: boolean
  error?: string
  id?: string
}

const TripInput = z.object({
  title: z.string().min(1, '이름을 적어 주세요').max(120),
  destination: z.string().max(120).optional(),
  startsOn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, '날짜 형식이 올바르지 않습니다'),
  endsOn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, '날짜 형식이 올바르지 않습니다'),
  scope: z.enum(['school', 'course', 'grade', 'class', 'department']),
  scopeCourse: z.enum(['elementary', 'middle', 'high', 'vocational']).optional(),
  scopeGrade: z.coerce.number().int().min(1).max(6).optional(),
  scopeClassId: z.string().uuid().optional(),
  scopeDepartmentId: z.string().uuid().optional(),
  contactNote: z.string().max(300).optional(),
})

/** 현장체험학습 등록 — 같은 학교 교직원이면 누구나(academic_events와 같은 방침). */
export async function createTrip(input: z.input<typeof TripInput>): Promise<SimpleResult> {
  const session = await requireSession()
  const parsed = TripInput.safeParse(input)
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? '입력을 확인하세요' }
  if (parsed.data.endsOn < parsed.data.startsOn) return { error: '종료일이 시작일보다 빨라야 합니다' }

  const supabase = await createClient()
  const { data, error } = await supabase
    .from('field_trips')
    .insert({
      school_id: session.school.id,
      title: parsed.data.title,
      destination: parsed.data.destination || null,
      starts_on: parsed.data.startsOn,
      ends_on: parsed.data.endsOn,
      scope: parsed.data.scope,
      scope_course: parsed.data.scopeCourse ?? null,
      scope_grade: parsed.data.scopeGrade ?? null,
      scope_class_id: parsed.data.scopeClassId ?? null,
      scope_department_id: parsed.data.scopeDepartmentId ?? null,
      contact_note: parsed.data.contactNote || null,
      created_by: session.userId,
    })
    .select('id')
    .single()

  if (error || !data) return { error: '등록하지 못했습니다' }

  await writeAudit({
    schoolId: session.school.id,
    actorId: session.userId,
    actorName: session.profile.name,
    action: AUDIT_ACTIONS.fieldTripCreate,
    targetTable: 'field_trips',
    targetId: data.id,
  })

  revalidatePath(PATH)
  revalidatePath('/calendar')
  return { ok: true, id: data.id }
}

/** 삭제 — 만든 사람 또는 관리자만(RLS가 최종 확인). */
export async function deleteTrip(id: string): Promise<SimpleResult> {
  const session = await requireSession()
  if (!z.string().uuid().safeParse(id).success) return { error: '잘못된 요청입니다' }

  const supabase = await createClient()
  const { error } = await supabase.from('field_trips').delete().eq('id', id)
  if (error) return { error: '지우지 못했습니다' }

  await writeAudit({
    schoolId: session.school.id,
    actorId: session.userId,
    actorName: session.profile.name,
    action: AUDIT_ACTIONS.fieldTripDelete,
    targetTable: 'field_trips',
    targetId: id,
  })

  revalidatePath(PATH)
  revalidatePath('/calendar')
  return { ok: true }
}

/** 체크리스트 항목 추가 — 만든 사람 또는 관리자만. */
export async function addChecklistItem(tripId: string, label: string): Promise<SimpleResult> {
  const session = await requireSession()
  if (!z.string().uuid().safeParse(tripId).success) return { error: '잘못된 요청입니다' }
  const trimmed = label.trim()
  if (!trimmed) return { error: '내용을 적어 주세요' }
  if (trimmed.length > 120) return { error: '너무 깁니다' }

  const supabase = await createClient()
  const { error } = await supabase
    .from('field_trip_checklist_items')
    .insert({ school_id: session.school.id, trip_id: tripId, label: trimmed })
  if (error) return { error: '추가하지 못했습니다' }

  revalidatePath(PATH)
  return { ok: true }
}

/** 체크리스트 항목 토글 — 만든 사람 또는 관리자만. */
export async function toggleChecklistItem(id: string, isChecked: boolean): Promise<SimpleResult> {
  const session = await requireSession()
  if (!z.string().uuid().safeParse(id).success) return { error: '잘못된 요청입니다' }

  const supabase = await createClient()
  const { error } = await supabase
    .from('field_trip_checklist_items')
    .update({
      is_checked: isChecked,
      checked_by: isChecked ? session.userId : null,
      checked_at: isChecked ? new Date().toISOString() : null,
    })
    .eq('id', id)
  if (error) return { error: '바꾸지 못했습니다' }

  await writeAudit({
    schoolId: session.school.id,
    actorId: session.userId,
    actorName: session.profile.name,
    action: AUDIT_ACTIONS.fieldTripChecklistToggle,
    targetTable: 'field_trip_checklist_items',
    targetId: id,
    meta: { isChecked },
  })

  revalidatePath(PATH)
  return { ok: true }
}

/** 체크리스트 항목 삭제 — 만든 사람 또는 관리자만. */
export async function removeChecklistItem(id: string): Promise<SimpleResult> {
  await requireSession()
  if (!z.string().uuid().safeParse(id).success) return { error: '잘못된 요청입니다' }

  const supabase = await createClient()
  const { error } = await supabase.from('field_trip_checklist_items').delete().eq('id', id)
  if (error) return { error: '지우지 못했습니다' }

  revalidatePath(PATH)
  return { ok: true }
}

/** 인솔자 추가 — 만든 사람 또는 관리자만. */
export async function addChaperone(tripId: string, profileId: string, note?: string): Promise<SimpleResult> {
  const session = await requireSession()
  if (!z.string().uuid().safeParse(tripId).success || !z.string().uuid().safeParse(profileId).success) {
    return { error: '잘못된 요청입니다' }
  }

  const supabase = await createClient()
  const { error } = await supabase.from('field_trip_chaperones').insert({
    school_id: session.school.id,
    trip_id: tripId,
    profile_id: profileId,
    note: note || null,
  })
  if (error) return { error: error.code === '23505' ? '이미 배정된 사람입니다' : '배정하지 못했습니다' }

  await writeAudit({
    schoolId: session.school.id,
    actorId: session.userId,
    actorName: session.profile.name,
    action: AUDIT_ACTIONS.fieldTripChaperoneAssign,
    targetTable: 'field_trip_chaperones',
    meta: { tripId, profileId },
  })

  revalidatePath(PATH)
  return { ok: true }
}

/** 인솔자 해제 — 만든 사람 또는 관리자만. */
export async function removeChaperone(id: string): Promise<SimpleResult> {
  await requireSession()
  if (!z.string().uuid().safeParse(id).success) return { error: '잘못된 요청입니다' }

  const supabase = await createClient()
  const { error } = await supabase.from('field_trip_chaperones').delete().eq('id', id)
  if (error) return { error: '해제하지 못했습니다' }

  revalidatePath(PATH)
  return { ok: true }
}
