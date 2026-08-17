import type { AvailabilityWindow, SupportAssignment, SupportNeed, SupportStaff } from '@/lib/staffing/coverage'
import type { TypedClient } from '@/lib/supabase/server'

/**
 * 보조인력 배치 화면에 필요한 것을 한 번에 읽어 온다.
 *
 * lib/data/substitution.ts와 같은 모양이다 — 화면(page.tsx)이 이 결과를
 * lib/staffing/coverage.ts의 checkCoverage()에 그대로 넘긴다.
 */
export interface AvailabilityRow {
  id: string
  profileId: string
  dayOfWeek: number
  startsMin: number
  endsMin: number
}

export interface StaffingContext {
  needs: SupportNeed[]
  staff: SupportStaff[]
  assignments: SupportAssignment[]
  classes: Array<{ id: string; name: string; course: 'elementary' | 'middle' | 'high' | 'vocational'; grade: number }>
  /** checkCoverage()에는 필요 없지만 화면에서 하나씩 지우려면 id가 있어야 한다 */
  availabilityRows: AvailabilityRow[]
}

export async function loadStaffingContext(
  supabase: TypedClient,
  opts: { schoolId: string; termId: string },
): Promise<StaffingContext> {
  const { schoolId, termId } = opts

  const [needsRes, availabilityRes, assignmentsRes, staffRes, classesRes] = await Promise.all([
    supabase
      .from('support_needs')
      .select('id, class_id, day_of_week, period_no, starts_min, ends_min')
      .eq('term_id', termId)
      .order('day_of_week')
      .order('period_no'),
    supabase
      .from('support_availability')
      .select('id, profile_id, day_of_week, starts_min, ends_min')
      .eq('school_id', schoolId)
      .order('day_of_week')
      .order('starts_min'),
    supabase.from('support_assignments').select('need_id, profile_id').eq('school_id', schoolId),
    // 보조인력 = 실무사 역할. 시간강사 등과 달리 이 화면이 다루는 대상은
    // "학급에 붙어 지원하는" 사람이라 role='staff'로 좁힌다.
    supabase
      .from('profiles')
      .select('id, name')
      .eq('school_id', schoolId)
      .eq('role', 'staff')
      .eq('is_active', true)
      .order('name'),
    supabase.from('classes').select('id, name, course, grade').eq('school_id', schoolId),
  ])

  const classById = new Map((classesRes.data ?? []).map((c) => [c.id, c]))

  const availabilityByStaff = new Map<string, AvailabilityWindow[]>()
  for (const row of availabilityRes.data ?? []) {
    const list = availabilityByStaff.get(row.profile_id) ?? []
    list.push({ dayOfWeek: row.day_of_week, startsMin: row.starts_min, endsMin: row.ends_min })
    availabilityByStaff.set(row.profile_id, list)
  }

  const staff: SupportStaff[] = (staffRes.data ?? []).map((row) => ({
    profileId: row.id,
    name: row.name,
    availability: availabilityByStaff.get(row.id) ?? [],
  }))

  const needs: SupportNeed[] = (needsRes.data ?? []).map((row) => ({
    id: row.id,
    classId: row.class_id,
    className: classById.get(row.class_id)?.name ?? '(삭제된 학급)',
    dayOfWeek: row.day_of_week,
    periodNo: row.period_no,
    startsMin: row.starts_min,
    endsMin: row.ends_min,
  }))

  const assignments: SupportAssignment[] = (assignmentsRes.data ?? []).map((row) => ({
    needId: row.need_id,
    profileId: row.profile_id,
  }))

  const availabilityRows: AvailabilityRow[] = (availabilityRes.data ?? []).map((row) => ({
    id: row.id,
    profileId: row.profile_id,
    dayOfWeek: row.day_of_week,
    startsMin: row.starts_min,
    endsMin: row.ends_min,
  }))

  return {
    needs,
    staff,
    assignments,
    classes: (classesRes.data ?? []).map((c) => ({
      id: c.id,
      name: c.name,
      course: c.course,
      grade: c.grade,
    })),
    availabilityRows,
  }
}
