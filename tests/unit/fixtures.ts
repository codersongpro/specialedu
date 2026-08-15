import { toMinutes } from '@/lib/scheduling/time'
import type {
  ClassInfo,
  CourseGroup,
  CourseLevel,
  Period,
  Reservation,
  Room,
  ScheduleContext,
  TimetableSlot,
} from '@/lib/scheduling/types'

/**
 * 실제 특수학교 시정표를 본뜬 픽스처.
 *
 * 핵심은 과정마다 교시 시각이 다르다는 점이다.
 * 초등 3교시(10:40)와 고등 3교시(11:00)는 20분 어긋나 있지만 겹친다.
 * 교시 번호로만 비교하는 구현은 이걸 놓친다.
 */
export const PERIODS: Period[] = [
  // 초등 — 40분 수업
  { course: 'elementary', periodNo: 1, label: '1교시', startsMin: toMinutes('09:00'), endsMin: toMinutes('09:40'), isAfterschool: false },
  { course: 'elementary', periodNo: 2, label: '2교시', startsMin: toMinutes('09:50'), endsMin: toMinutes('10:30'), isAfterschool: false },
  { course: 'elementary', periodNo: 3, label: '3교시', startsMin: toMinutes('10:40'), endsMin: toMinutes('11:20'), isAfterschool: false },
  { course: 'elementary', periodNo: 4, label: '4교시', startsMin: toMinutes('11:30'), endsMin: toMinutes('12:10'), isAfterschool: false },

  // 고등 — 50분 수업, 시작도 다르다
  { course: 'high', periodNo: 1, label: '1교시', startsMin: toMinutes('09:00'), endsMin: toMinutes('09:50'), isAfterschool: false },
  { course: 'high', periodNo: 2, label: '2교시', startsMin: toMinutes('10:00'), endsMin: toMinutes('10:50'), isAfterschool: false },
  { course: 'high', periodNo: 3, label: '3교시', startsMin: toMinutes('11:00'), endsMin: toMinutes('11:50'), isAfterschool: false },
  { course: 'high', periodNo: 4, label: '4교시', startsMin: toMinutes('12:00'), endsMin: toMinutes('12:50'), isAfterschool: false },

  // 전공과 — 직업실습은 블록 타임
  { course: 'vocational', periodNo: 1, label: '1블록', startsMin: toMinutes('09:00'), endsMin: toMinutes('10:40'), isAfterschool: false },
  { course: 'vocational', periodNo: 2, label: '2블록', startsMin: toMinutes('10:50'), endsMin: toMinutes('12:30'), isAfterschool: false },
]

export function period(course: CourseLevel, periodNo: number): Period {
  const found = PERIODS.find((p) => p.course === course && p.periodNo === periodNo)
  if (!found) throw new Error(`픽스처에 없는 교시: ${course} ${periodNo}`)
  return found
}

export const ROOMS: Room[] = [
  { id: 'room-cook', name: '요리실습실', roomType: 'cooking', floor: 2, capacity: 12, features: ['조리대', '싱크대', '인덕션'], requiresApproval: false, isActive: true },
  { id: 'room-gym', name: '체육관', roomType: 'gym', floor: 1, capacity: 40, features: ['매트', '음향'], requiresApproval: true, isActive: true },
  { id: 'room-sensory', name: '감각통합실', roomType: 'therapy', floor: 3, capacity: 6, features: ['그네', '볼풀'], requiresApproval: false, isActive: true },
  { id: 'room-barista', name: '바리스타실습실', roomType: 'vocational', floor: 2, capacity: 10, features: ['에스프레소머신', '싱크대'], requiresApproval: false, isActive: true },
  { id: 'room-closed', name: '목공실', roomType: 'workshop', floor: 1, capacity: 8, features: ['작업대'], requiresApproval: false, isActive: false },
]

export const CLASSES: ClassInfo[] = [
  { id: 'cls-e3', course: 'elementary', grade: 3, name: '초3-1', studentCount: 6 },
  { id: 'cls-h3a', course: 'high', grade: 3, name: '고3-1', studentCount: 7 },
  { id: 'cls-h3b', course: 'high', grade: 3, name: '고3-2', studentCount: 7 },
  { id: 'cls-v1', course: 'vocational', grade: 1, name: '전공과1', studentCount: 8 },
]

export const GROUPS: CourseGroup[] = [
  {
    id: 'grp-barista',
    name: '바리스타 선택',
    course: 'high',
    memberClassIds: ['cls-h3a', 'cls-h3b'],
    studentCount: 9,
  },
]

export const TEACHERS = new Map<string, string>([
  ['t-kim', '김하늘'],
  ['t-lee', '이바다'],
  ['t-park', '박가온'],
  ['t-choi', '최나래'],
])

export function makeContext(overrides: Partial<ScheduleContext> = {}): ScheduleContext {
  return {
    rooms: new Map(ROOMS.map((r) => [r.id, r])),
    classes: new Map(CLASSES.map((c) => [c.id, c])),
    groups: new Map(GROUPS.map((g) => [g.id, g])),
    teacherNames: new Map(TEACHERS),
    reservations: [],
    slots: [],
    blackouts: [],
    ...overrides,
  }
}

export function slot(partial: Partial<TimetableSlot> & { course: CourseLevel; periodNo: number }): TimetableSlot {
  const p = period(partial.course, partial.periodNo)
  return {
    id: `slot-${Math.random().toString(36).slice(2, 8)}`,
    dayOfWeek: 1,
    classId: null,
    courseGroupId: null,
    teacherId: null,
    coTeacherId: null,
    subjectId: null,
    roomId: null,
    startsMin: p.startsMin,
    endsMin: p.endsMin,
    ...partial,
  }
}

export function reservation(
  partial: Partial<Reservation> & { course: CourseLevel; periodNo: number; roomId: string },
): Reservation {
  const p = period(partial.course, partial.periodNo)
  return {
    id: `res-${Math.random().toString(36).slice(2, 8)}`,
    reservedDate: '2026-03-09',
    classId: null,
    courseGroupId: null,
    requesterId: 't-kim',
    coTeacherId: null,
    kind: 'regular',
    status: 'approved',
    purpose: null,
    startsMin: p.startsMin,
    endsMin: p.endsMin,
    ...partial,
  }
}

export function bookingRequest(
  partial: Partial<import('@/lib/scheduling/types').BookingRequest> & {
    course: CourseLevel
    periodNo: number
    roomId: string
  },
) {
  const p = period(partial.course, partial.periodNo)
  return {
    reservedDate: '2026-03-09',
    dayOfWeek: 1,
    classId: null,
    courseGroupId: null,
    requesterId: 't-kim',
    coTeacherId: null,
    kind: 'regular' as const,
    startsMin: p.startsMin,
    endsMin: p.endsMin,
    ...partial,
  }
}
