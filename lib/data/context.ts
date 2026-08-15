import type { PeriodRow } from '@/lib/supabase/database.types'
import type { TypedClient } from '@/lib/supabase/server'
import type {
  ClassInfo,
  CourseGroup,
  CourseLevel,
  Reservation,
  Room,
  ScheduleContext,
  TimetableSlot,
} from '@/lib/scheduling/types'

type Client = TypedClient

/**
 * 충돌 검사에 필요한 그 날짜의 주변 상황을 한 번에 읽어 온다.
 *
 * 예약 화면은 한 주치를 한 번에 그리므로, 날짜별로 조회를 반복하면
 * 쿼리가 요일 수만큼 늘어난다. 기간으로 한 번만 읽고 메모리에서 나눈다.
 */
export async function loadScheduleContext(
  supabase: Client,
  opts: {
    schoolId: string
    termId: string
    fromDate: string
    toDate: string
  },
): Promise<ScheduleContext & { periods: PeriodRow[] }> {
  const [roomsRes, classesRes, groupsRes, profilesRes, periodsRes, slotsRes, reservationsRes, blackoutsRes] =
    await Promise.all([
      supabase.from('rooms').select('*').eq('school_id', opts.schoolId).order('name'),
      supabase.from('classes').select('*').eq('school_id', opts.schoolId).order('grade'),
      supabase.from('course_groups').select('*').eq('term_id', opts.termId),
      supabase.from('profiles').select('id, name').eq('school_id', opts.schoolId),
      supabase.from('periods').select('*').eq('school_id', opts.schoolId).order('period_no'),
      supabase.from('timetable_slots').select('*').eq('term_id', opts.termId),
      supabase
        .from('room_reservations')
        .select('*')
        .eq('school_id', opts.schoolId)
        .gte('reserved_date', opts.fromDate)
        .lte('reserved_date', opts.toDate),
      supabase
        .from('room_blackouts')
        .select('*')
        .eq('school_id', opts.schoolId)
        .lte('starts_on', opts.toDate)
        .gte('ends_on', opts.fromDate),
    ])

  const rooms = new Map<string, Room>()
  for (const row of roomsRes.data ?? []) {
    rooms.set(row.id, {
      id: row.id,
      name: row.name,
      roomType: row.room_type,
      floor: row.floor,
      capacity: row.capacity,
      features: row.features ?? [],
      requiresApproval: row.requires_approval,
      isActive: row.is_active,
    })
  }

  const classes = new Map<string, ClassInfo>()
  for (const row of classesRes.data ?? []) {
    classes.set(row.id, {
      id: row.id,
      course: row.course,
      grade: row.grade,
      name: row.name,
      studentCount: row.student_count,
    })
  }

  const groups = new Map<string, CourseGroup>()
  for (const row of groupsRes.data ?? []) {
    groups.set(row.id, {
      id: row.id,
      name: row.name,
      course: row.course,
      memberClassIds: row.member_class_ids ?? [],
      studentCount: row.student_count,
    })
  }

  const teacherNames = new Map<string, string>()
  for (const row of profilesRes.data ?? []) teacherNames.set(row.id, row.name)

  const slots: TimetableSlot[] = (slotsRes.data ?? []).map((row) => ({
    id: row.id,
    dayOfWeek: row.day_of_week,
    course: row.course,
    periodNo: row.period_no,
    startsMin: row.starts_min,
    endsMin: row.ends_min,
    classId: row.class_id,
    courseGroupId: row.course_group_id,
    teacherId: row.teacher_id,
    coTeacherId: row.co_teacher_id,
    subjectId: row.subject_id,
    roomId: row.room_id,
  }))

  const reservations: Reservation[] = (reservationsRes.data ?? []).map((row) => ({
    id: row.id,
    roomId: row.room_id,
    reservedDate: row.reserved_date,
    course: row.course,
    periodNo: row.period_no,
    startsMin: row.starts_min,
    endsMin: row.ends_min,
    classId: row.class_id,
    courseGroupId: row.course_group_id,
    requesterId: row.requester_id,
    coTeacherId: row.co_teacher_id,
    kind: row.kind,
    status: row.status,
    purpose: row.purpose,
  }))

  const blackouts = (blackoutsRes.data ?? []).map((row) => ({
    id: row.id,
    roomId: row.room_id,
    startsOn: row.starts_on,
    endsOn: row.ends_on,
    startsMin: row.starts_min,
    endsMin: row.ends_min,
    reason: row.reason,
  }))

  return {
    rooms,
    classes,
    groups,
    teacherNames,
    slots,
    reservations,
    blackouts,
    periods: periodsRes.data ?? [],
  }
}

export function periodsFor(periods: readonly PeriodRow[], course: CourseLevel): PeriodRow[] {
  return periods.filter((p) => p.course === course).sort((a, b) => a.period_no - b.period_no)
}

/** 현재 학기. 없으면 가장 최근 학기. */
export async function getCurrentTerm(supabase: Client, schoolId: string) {
  const { data } = await supabase
    .from('terms')
    .select('*')
    .eq('school_id', schoolId)
    .order('is_current', { ascending: false })
    .order('year', { ascending: false })
    .order('semester', { ascending: false })
    .limit(1)
    .maybeSingle()

  return data
}
