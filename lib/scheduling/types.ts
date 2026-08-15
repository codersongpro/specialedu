import type { TimeSpan } from './time'

export type CourseLevel = 'elementary' | 'middle' | 'high' | 'vocational'

export const COURSE_LABEL: Record<CourseLevel, string> = {
  elementary: '초등',
  middle: '중학',
  high: '고등',
  vocational: '전공과',
}

export type BookingKind =
  | 'regular'
  | 'onetime'
  | 'afterschool'
  | 'vocational_practice'
  | 'co_teaching'

export const BOOKING_KIND_LABEL: Record<BookingKind, string> = {
  regular: '정규 교과',
  onetime: '일회성',
  afterschool: '방과후',
  vocational_practice: '직업실습',
  co_teaching: '강사협력',
}

export type BookingStatus = 'pending' | 'approved' | 'rejected' | 'cancelled'

/** 과정별 시정표 한 줄 */
export interface Period extends TimeSpan {
  course: CourseLevel
  periodNo: number
  label: string
  isAfterschool: boolean
}

export interface Room {
  id: string
  name: string
  roomType: string
  floor: number | null
  capacity: number | null
  features: string[]
  requiresApproval: boolean
  isActive: boolean
}

export interface ClassInfo {
  id: string
  course: CourseLevel
  grade: number
  name: string
  studentCount: number
}

/** 고교학점제 선택과목 · 자유학기 주제선택활동 등 학급을 가로지르는 묶음 */
export interface CourseGroup {
  id: string
  name: string
  course: CourseLevel
  memberClassIds: string[]
  studentCount: number
}

/** 정규 시간표 한 칸 */
export interface TimetableSlot extends TimeSpan {
  id: string
  dayOfWeek: number
  course: CourseLevel
  periodNo: number
  classId: string | null
  courseGroupId: string | null
  teacherId: string | null
  coTeacherId: string | null
  subjectId: string | null
  roomId: string | null
}

/** 특별실 예약 한 건 */
export interface Reservation extends TimeSpan {
  id: string
  roomId: string
  reservedDate: string
  course: CourseLevel
  periodNo: number
  classId: string | null
  courseGroupId: string | null
  requesterId: string
  coTeacherId: string | null
  kind: BookingKind
  status: BookingStatus
  purpose: string | null
}

export interface Blackout extends TimeSpan {
  id: string
  roomId: string
  startsOn: string
  endsOn: string
  reason: string
}

/** 예약하려는 내용 */
export interface BookingRequest extends TimeSpan {
  reservationId?: string
  roomId: string
  reservedDate: string
  dayOfWeek: number
  course: CourseLevel
  periodNo: number
  classId: string | null
  courseGroupId: string | null
  requesterId: string
  coTeacherId: string | null
  kind: BookingKind
}

/** 충돌 검사에 필요한 그 날짜의 주변 상황 */
export interface ScheduleContext {
  rooms: Map<string, Room>
  classes: Map<string, ClassInfo>
  groups: Map<string, CourseGroup>
  teacherNames: Map<string, string>
  /** 같은 날짜의 예약 (취소·반려 제외) */
  reservations: Reservation[]
  /** 같은 요일·같은 학기의 정규 시간표 */
  slots: TimetableSlot[]
  /** 해당 날짜에 걸리는 사용 불가 구간 */
  blackouts: Blackout[]
}

export type ConflictType =
  | 'room_taken'
  | 'room_pending'
  | 'room_blackout'
  | 'room_inactive'
  | 'teacher_busy'
  | 'co_teacher_busy'
  | 'class_busy'
  | 'group_busy'

export type ConflictSeverity = 'block' | 'warn'

export interface Conflict {
  type: ConflictType
  severity: ConflictSeverity
  message: string
  withId?: string
}
