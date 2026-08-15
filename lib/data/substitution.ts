import { weekDates } from '@/lib/date'
import type { SubstituteCandidate, SubstitutionTarget } from '@/lib/substitution/score'
import { DEFAULT_WEIGHTS, type SubstitutionWeights } from '@/lib/substitution/score'
import type { TypedClient } from '@/lib/supabase/server'
import type { CourseLevel } from '@/lib/scheduling/types'

/**
 * 결보강 후보를 만들 때 필요한 것들을 모은다.
 *
 * 교사가 어떤 교과를 맡을 수 있는지는 따로 표를 두지 않고 시간표에서 끌어온다.
 * 별도 표를 두면 관리자가 두 곳을 맞춰야 하고, 결국 한쪽이 낡는다.
 */
export async function loadCandidates(
  supabase: TypedClient,
  opts: {
    schoolId: string
    termId: string
    target: SubstitutionTarget
  },
): Promise<SubstituteCandidate[]> {
  const { schoolId, termId, target } = opts
  const week = weekDates(target.date, 7)
  const weekFrom = week[0]!
  const weekTo = week[week.length - 1]!

  const [profilesRes, slotsRes, classesRes, roomsRes, weekSubsRes, daySubsRes] = await Promise.all([
    supabase.from('profiles').select('*').eq('school_id', schoolId).eq('is_active', true),
    supabase.from('timetable_slots').select('*').eq('term_id', termId),
    supabase.from('classes').select('*').eq('school_id', schoolId),
    supabase.from('rooms').select('id, floor').eq('school_id', schoolId),
    supabase
      .from('substitution_assignments')
      .select('assigned_teacher_id')
      .eq('school_id', schoolId)
      .gte('assign_date', weekFrom)
      .lte('assign_date', weekTo)
      .neq('status', 'declined'),
    supabase
      .from('substitution_assignments')
      .select('assigned_teacher_id, starts_min, ends_min, period_no')
      .eq('school_id', schoolId)
      .eq('assign_date', target.date)
      .neq('status', 'declined'),
  ])

  const profiles = profilesRes.data ?? []
  const slots = slotsRes.data ?? []
  const classes = classesRes.data ?? []
  const floorByRoom = new Map((roomsRes.data ?? []).map((r) => [r.id, r.floor]))

  const weeklyCount = new Map<string, number>()
  for (const row of weekSubsRes.data ?? []) {
    if (!row.assigned_teacher_id) continue
    weeklyCount.set(row.assigned_teacher_id, (weeklyCount.get(row.assigned_teacher_id) ?? 0) + 1)
  }

  return profiles.map((profile) => {
    const mySlots = slots.filter(
      (s) => s.teacher_id === profile.id || s.co_teacher_id === profile.id,
    )
    const todaySlots = mySlots.filter((s) => s.day_of_week === target.dayOfWeek)

    const mySubsToday = (daySubsRes.data ?? []).filter(
      (s) => s.assigned_teacher_id === profile.id,
    )

    // 그날 이미 묶인 시간 = 정규 수업 + 이미 배정된 결보강
    const busySpans = [
      ...todaySlots.map((s) => ({ startsMin: s.starts_min, endsMin: s.ends_min })),
      ...mySubsToday.map((s) => ({ startsMin: s.starts_min, endsMin: s.ends_min })),
    ]
    const busyPeriods = [
      ...todaySlots.map((s) => s.period_no),
      ...mySubsToday.map((s) => s.period_no),
    ]

    const myClassIds = new Set(
      mySlots.map((s) => s.class_id).filter((id): id is string => id != null),
    )
    const myClasses = classes.filter((c) => myClassIds.has(c.id))

    // 앞뒤 교시에 있던 교실의 층 — 이동 거리를 보는 데 쓴다
    const adjacentFloors = todaySlots
      .filter((s) => Math.abs(s.period_no - target.periodNo) === 1)
      .map((s) => (s.room_id ? floorByRoom.get(s.room_id) : null))
      .filter((floor): floor is number => floor != null)

    return {
      teacherId: profile.id,
      name: profile.name,
      employment: profile.employment,
      isActive: profile.is_active,
      workDays: profile.work_days ?? [1, 2, 3, 4, 5],
      subjectIds: unique(
        mySlots.map((s) => s.subject_id).filter((id): id is string => id != null),
      ),
      courses: unique(myClasses.map((c) => c.course)) as CourseLevel[],
      grades: unique(myClasses.map((c) => c.grade)),
      homeroomClassIds: classes
        .filter((c) => c.homeroom_teacher_id === profile.id || c.assistant_teacher_id === profile.id)
        .map((c) => c.id),
      weeklySubCount: weeklyCount.get(profile.id) ?? 0,
      busySpans,
      busyPeriods,
      adjacentFloors,
    }
  })
}

export async function loadWeights(
  supabase: TypedClient,
  schoolId: string,
): Promise<{ weights: SubstitutionWeights; longRunThreshold: number }> {
  const { data } = await supabase
    .from('substitution_rules')
    .select('*')
    .eq('school_id', schoolId)
    .maybeSingle()

  if (!data) return { weights: DEFAULT_WEIGHTS, longRunThreshold: 4 }

  return {
    // 관리자가 일부만 바꿨을 수 있으니 기본값 위에 덮어쓴다
    weights: { ...DEFAULT_WEIGHTS, ...(data.weights as Partial<SubstitutionWeights>) },
    longRunThreshold: data.long_run_threshold,
  }
}

function unique<T>(values: T[]): T[] {
  return [...new Set(values)]
}
