'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { toMinutes } from '@/lib/scheduling/time'
import { AUDIT_ACTIONS, writeAudit } from '@/lib/security/audit'
import { createClient, isAdmin, requireSession } from '@/lib/supabase/server'

const PATH = '/staffing/assistants'

export interface SimpleResult {
  ok?: boolean
  error?: string
}

const NeedInput = z.object({
  termId: z.string().uuid(),
  classId: z.string().uuid('학급을 골라 주세요'),
  course: z.enum(['elementary', 'middle', 'high', 'vocational']),
  dayOfWeek: z.number().int().min(1).max(5),
  periodNo: z.number().int().min(0).max(15),
  note: z.string().max(200).optional(),
})

/** 지원 필요 시간 추가 — 관리자만. 교시 → 분 변환은 DB 트리거가 한다. */
export async function addNeed(input: z.input<typeof NeedInput>): Promise<SimpleResult> {
  const session = await requireSession()
  if (!isAdmin(session.profile)) return { error: '관리자만 할 수 있습니다' }

  const parsed = NeedInput.safeParse(input)
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? '입력을 확인하세요' }

  const supabase = await createClient()
  const { data, error } = await supabase
    .from('support_needs')
    .insert({
      school_id: session.school.id,
      term_id: parsed.data.termId,
      class_id: parsed.data.classId,
      course: parsed.data.course,
      day_of_week: parsed.data.dayOfWeek,
      period_no: parsed.data.periodNo,
      note: parsed.data.note || null,
      created_by: session.userId,
    })
    .select('id')
    .single()

  if (error || !data) {
    return { error: error?.code === '23505' ? '이미 등록된 시간입니다' : '저장하지 못했습니다' }
  }

  await writeAudit({
    schoolId: session.school.id,
    actorId: session.userId,
    actorName: session.profile.name,
    action: AUDIT_ACTIONS.supportNeedCreate,
    targetTable: 'support_needs',
    targetId: data.id,
  })

  revalidatePath(PATH)
  return { ok: true }
}

/** 지원 필요 시간 삭제 — 관리자만. 배치된 담당자도 cascade로 함께 지워진다. */
export async function removeNeed(id: string): Promise<SimpleResult> {
  const session = await requireSession()
  if (!isAdmin(session.profile)) return { error: '관리자만 할 수 있습니다' }
  if (!z.string().uuid().safeParse(id).success) return { error: '잘못된 요청입니다' }

  const supabase = await createClient()
  const { error } = await supabase.from('support_needs').delete().eq('id', id)
  if (error) return { error: '지우지 못했습니다' }

  await writeAudit({
    schoolId: session.school.id,
    actorId: session.userId,
    actorName: session.profile.name,
    action: AUDIT_ACTIONS.supportNeedDelete,
    targetTable: 'support_needs',
    targetId: id,
  })

  revalidatePath(PATH)
  return { ok: true }
}

const AssignInput = z.object({
  needId: z.string().uuid(),
  profileId: z.string().uuid(),
})

/**
 * 담당자 배정 — 관리자만. 이미 배정돼 있으면 바꾼다.
 *
 * 여기서 중복·공백을 막지 않는다 — 이 화면의 목적 자체가 그걸 경고로
 * 보여주는 것이다(lib/staffing/coverage.ts 설명 참고). 굳이 다른 사람과
 * 겹치는 시간에 배정해야 하는 예외적인 사정이 있을 수도 있으니, 저장은
 * 항상 되고 화면에 경고만 뜬다.
 */
export async function assignStaff(input: z.input<typeof AssignInput>): Promise<SimpleResult> {
  const session = await requireSession()
  if (!isAdmin(session.profile)) return { error: '관리자만 할 수 있습니다' }

  const parsed = AssignInput.safeParse(input)
  if (!parsed.success) return { error: '잘못된 요청입니다' }

  const supabase = await createClient()
  const { error } = await supabase.from('support_assignments').upsert(
    {
      school_id: session.school.id,
      need_id: parsed.data.needId,
      profile_id: parsed.data.profileId,
      assigned_by: session.userId,
    },
    { onConflict: 'need_id' },
  )

  if (error) return { error: '배정하지 못했습니다' }

  await writeAudit({
    schoolId: session.school.id,
    actorId: session.userId,
    actorName: session.profile.name,
    action: AUDIT_ACTIONS.supportAssign,
    targetTable: 'support_assignments',
    meta: { needId: parsed.data.needId, profileId: parsed.data.profileId },
  })

  revalidatePath(PATH)
  return { ok: true }
}

/** 배정 해제 — 관리자만. */
export async function clearAssignment(needId: string): Promise<SimpleResult> {
  const session = await requireSession()
  if (!isAdmin(session.profile)) return { error: '관리자만 할 수 있습니다' }
  if (!z.string().uuid().safeParse(needId).success) return { error: '잘못된 요청입니다' }

  const supabase = await createClient()
  const { error } = await supabase.from('support_assignments').delete().eq('need_id', needId)
  if (error) return { error: '해제하지 못했습니다' }

  await writeAudit({
    schoolId: session.school.id,
    actorId: session.userId,
    actorName: session.profile.name,
    action: AUDIT_ACTIONS.supportUnassign,
    targetTable: 'support_assignments',
    meta: { needId },
  })

  revalidatePath(PATH)
  return { ok: true }
}

const AvailabilityInput = z.object({
  profileId: z.string().uuid(),
  dayOfWeek: z.number().int().min(1).max(5),
  startsAt: z.string().regex(/^\d{1,2}:\d{2}$/, '시각 형식이 올바르지 않습니다'),
  endsAt: z.string().regex(/^\d{1,2}:\d{2}$/, '시각 형식이 올바르지 않습니다'),
})

/** 근무 가능 시간 추가 — 관리자만. 같은 사람·같은 요일에 겹치면 DB가 거부한다. */
export async function saveAvailability(input: z.input<typeof AvailabilityInput>): Promise<SimpleResult> {
  const session = await requireSession()
  if (!isAdmin(session.profile)) return { error: '관리자만 할 수 있습니다' }

  const parsed = AvailabilityInput.safeParse(input)
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? '입력을 확인하세요' }

  let startsMin: number
  let endsMin: number
  try {
    startsMin = toMinutes(parsed.data.startsAt)
    endsMin = toMinutes(parsed.data.endsAt)
  } catch {
    return { error: '시각 형식이 올바르지 않습니다' }
  }
  if (endsMin <= startsMin) return { error: '끝나는 시각이 시작 시각보다 늦어야 합니다' }

  const supabase = await createClient()
  const { error } = await supabase.from('support_availability').insert({
    school_id: session.school.id,
    profile_id: parsed.data.profileId,
    day_of_week: parsed.data.dayOfWeek,
    starts_min: startsMin,
    ends_min: endsMin,
  })

  if (error) {
    return {
      error: error.code === '23P01' ? '이미 등록된 시간대와 겹칩니다' : '저장하지 못했습니다',
    }
  }

  await writeAudit({
    schoolId: session.school.id,
    actorId: session.userId,
    actorName: session.profile.name,
    action: AUDIT_ACTIONS.supportAvailabilitySave,
    targetTable: 'support_availability',
    meta: { profileId: parsed.data.profileId },
  })

  revalidatePath(PATH)
  return { ok: true }
}

/** 근무 가능 시간 삭제 — 관리자만. */
export async function removeAvailability(id: string): Promise<SimpleResult> {
  const session = await requireSession()
  if (!isAdmin(session.profile)) return { error: '관리자만 할 수 있습니다' }
  if (!z.string().uuid().safeParse(id).success) return { error: '잘못된 요청입니다' }

  const supabase = await createClient()
  const { error } = await supabase.from('support_availability').delete().eq('id', id)
  if (error) return { error: '지우지 못했습니다' }

  revalidatePath(PATH)
  return { ok: true }
}
