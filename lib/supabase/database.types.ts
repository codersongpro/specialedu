/**
 * DB 타입.
 *
 * 실제 개발에서는 `npm run db:types` (supabase gen types typescript) 로 덮어쓴다.
 * 이 파일은 마이그레이션과 손으로 맞춘 것이라, 스키마를 바꾸면 함께 고쳐야 한다.
 */

export type UserRole = 'admin' | 'manager' | 'teacher' | 'part_time' | 'staff'
export type CourseLevel = 'elementary' | 'middle' | 'high' | 'vocational'
export type EmploymentType = 'full_time' | 'fixed_term' | 'part_time' | 'assistant'
export type BookingKind =
  | 'regular'
  | 'onetime'
  | 'afterschool'
  | 'vocational_practice'
  | 'co_teaching'
export type BookingStatus = 'pending' | 'approved' | 'rejected' | 'cancelled'
export type AbsenceReason = 'business_trip' | 'sick' | 'annual' | 'training' | 'official' | 'other'
export type SubstitutionStatus = 'pending' | 'assigned' | 'confirmed' | 'declined'
export type EventScope = 'school' | 'course' | 'grade' | 'class' | 'department'
export type EventCategory =
  | 'academic'
  | 'grade_event'
  | 'course_event'
  | 'class_event'
  | 'exam'
  | 'vacation'
  | 'holiday'
  | 'training'
  | 'other'

export type SchoolRow = {
  id: string
  name: string
  neis_code: string | null
  timezone: string
  is_demo: boolean
  allow_free_text_ai: boolean
  gemini_key_enc: string | null
  gemini_key_hint: string | null
}

export type ProfileRow = {
  id: string
  school_id: string
  name: string
  role: UserRole
  employment: EmploymentType
  department_id: string | null
  work_days: number[]
  gemini_key_enc: string | null
  gemini_key_hint: string | null
  calendar_token: string
  is_active: boolean
}

export type DepartmentRow = {
  id: string
  school_id: string
  name: string
  head_id: string | null
}

export type TermRow = {
  id: string
  school_id: string
  year: number
  semester: number
  starts_on: string
  ends_on: string
  is_free_semester: boolean
  is_current: boolean
}

export type PeriodRow = {
  id: string
  school_id: string
  course: CourseLevel
  period_no: number
  label: string
  starts_min: number
  ends_min: number
  is_afterschool: boolean
}

export type SubjectRow = {
  id: string
  school_id: string
  name: string
}

export type ClassRow = {
  id: string
  school_id: string
  course: CourseLevel
  grade: number
  name: string
  homeroom_teacher_id: string | null
  assistant_teacher_id: string | null
  student_count: number
}

export type CourseGroupRow = {
  id: string
  school_id: string
  term_id: string
  course: CourseLevel
  name: string
  subject_id: string | null
  member_class_ids: string[]
  student_count: number
}

export type RoomRow = {
  id: string
  school_id: string
  name: string
  room_type: string
  floor: number | null
  capacity: number | null
  features: string[]
  managed_by: string | null
  requires_approval: boolean
  is_active: boolean
}

export type TimetableSlotRow = {
  id: string
  school_id: string
  term_id: string
  course: CourseLevel
  day_of_week: number
  period_no: number
  starts_min: number
  ends_min: number
  class_id: string | null
  course_group_id: string | null
  teacher_id: string | null
  co_teacher_id: string | null
  subject_id: string | null
  room_id: string | null
}

export type RoomReservationRow = {
  id: string
  school_id: string
  rule_id: string | null
  room_id: string
  reserved_date: string
  course: CourseLevel
  period_no: number
  starts_min: number
  ends_min: number
  class_id: string | null
  course_group_id: string | null
  requester_id: string
  co_teacher_id: string | null
  kind: BookingKind
  status: BookingStatus
  purpose: string | null
  approved_by: string | null
  approved_at: string | null
  reject_reason: string | null
}

export type RoomBlackoutRow = {
  id: string
  school_id: string
  room_id: string
  starts_on: string
  ends_on: string
  starts_min: number
  ends_min: number
  reason: string
}

export type AbsenceRow = {
  id: string
  school_id: string
  teacher_id: string
  starts_on: string
  ends_on: string
  reason: AbsenceReason
  note: string | null
  created_by: string | null
}

export type SubstitutionAssignmentRow = {
  id: string
  school_id: string
  absence_id: string
  assign_date: string
  course: CourseLevel
  period_no: number
  starts_min: number
  ends_min: number
  timetable_slot_id: string | null
  class_id: string | null
  course_group_id: string | null
  subject_id: string | null
  room_id: string | null
  assigned_teacher_id: string | null
  status: SubstitutionStatus
  score: number | null
  score_breakdown: unknown
  is_paid: boolean
  note: string | null
  assigned_by: string | null
  assigned_at: string | null
}

export type SubstitutionRulesRow = {
  school_id: string
  weights: Record<string, number>
  long_run_threshold: number
  updated_by: string | null
  updated_at: string
}

export type AcademicEventRow = {
  id: string
  school_id: string
  title: string
  detail: string | null
  starts_on: string
  ends_on: string
  all_day: boolean
  starts_min: number | null
  ends_min: number | null
  scope: EventScope
  scope_course: CourseLevel | null
  scope_grade: number | null
  scope_class_id: string | null
  scope_department_id: string | null
  category: EventCategory
  color: string | null
  source: string
  source_key: string | null
  created_by: string | null
}

export type AuditLogRow = {
  id: number
  school_id: string | null
  actor_id: string | null
  actor_name: string | null
  action: string
  target_table: string | null
  target_id: string | null
  meta: unknown
  ip: string | null
  user_agent: string | null
  created_at: string
}

export type SensitivityAckRow = {
  id: number
  school_id: string
  profile_id: string
  zone: string
  acked_at: string
}

export type InvitationRow = {
  id: string
  school_id: string
  email: string
  name: string
  role: UserRole
  employment: EmploymentType
  department_id: string | null
  token_hash: string
  expires_at: string
  accepted_at: string | null
  invited_by: string | null
  created_at: string
}

export type StudentRow = {
  id: string
  school_id: string
  class_id: string | null
  student_code: string
  display_name: string
  is_active: boolean
}

export type RoomReservationRuleRow = {
  id: string
  school_id: string
  term_id: string
  room_id: string
  course: CourseLevel
  day_of_week: number
  period_no: number
  effective_from: string
  effective_to: string
  class_id: string | null
  course_group_id: string | null
  requester_id: string
  co_teacher_id: string | null
  kind: BookingKind
  purpose: string | null
}

export type AiCacheRow = {
  id: string
  school_id: string
  tool: string
  input_hash: string
  result: unknown
  hit_count: number
  created_at: string
  expires_at: string
}

export type BudgetScope = 'department' | 'class'
export type BudgetExpenseStatus = 'pending' | 'approved' | 'rejected'

export type BudgetLineRow = {
  id: string
  school_id: string
  fiscal_year: number
  scope: BudgetScope
  department_id: string | null
  class_id: string | null
  name: string
  allocated_amount: number
  note: string | null
  created_by: string | null
}

export type BudgetExpenseRow = {
  id: string
  school_id: string
  budget_line_id: string
  requested_by: string | null
  amount: number
  description: string
  spent_on: string
  status: BudgetExpenseStatus
  receipt_path: string | null
  reviewed_by: string | null
  reviewed_at: string | null
  reject_reason: string | null
}

export type AiUsageLogRow = {
  id: number
  school_id: string
  profile_id: string | null
  tool: string
  key_source: string
  cache_hit: boolean
  masked_count: number
  ok: boolean
  error_code: string | null
  created_at: string
}

export type BehaviorCategoryRow = {
  id: string
  school_id: string
  name: string
  sort_order: number
  is_active: boolean
}

export type PbsRecordRow = {
  id: string
  school_id: string
  student_id: string
  category_id: string | null
  occurred_at: string
  location: string | null
  antecedent_enc: string | null
  consequence_enc: string | null
  note_enc: string | null
  recorded_by: string | null
}

type Table<Row, Insert = Partial<Row>, Update = Partial<Row>> = {
  Row: Row
  Insert: Insert
  Update: Update
  Relationships: []
}

/**
 * 뷰·함수는 아직 없다.
 *
 * 여기에 Record<string, never> 를 쓰면 안 된다. "모든 이름의 뷰가 존재하고
 * 타입은 never" 라는 뜻이 되어, from('profiles') 같은 조회가 테이블이 아니라
 * never 인 뷰로 해석되면서 모든 쿼리 타입이 무너진다.
 */
type Empty = Record<never, never>

/**
 * interface 가 아니라 type 이어야 한다.
 *
 * interface 에는 암묵적 인덱스 시그니처가 없어서 supabase-js 의
 * `Database extends Record<string, GenericSchema>` 제약을 통과하지 못한다.
 * 그러면 모든 쿼리 타입이 조용히 never 로 무너진다.
 */
export type Database = {
  public: {
    Tables: {
      schools: Table<SchoolRow>
      profiles: Table<ProfileRow>
      departments: Table<DepartmentRow>
      terms: Table<TermRow>
      periods: Table<PeriodRow>
      subjects: Table<SubjectRow>
      classes: Table<ClassRow>
      course_groups: Table<CourseGroupRow>
      rooms: Table<RoomRow>
      timetable_slots: Table<TimetableSlotRow>
      room_reservations: Table<RoomReservationRow>
      room_blackouts: Table<RoomBlackoutRow>
      absences: Table<AbsenceRow>
      substitution_assignments: Table<SubstitutionAssignmentRow>
      substitution_rules: Table<SubstitutionRulesRow>
      academic_events: Table<AcademicEventRow>
      audit_logs: Table<AuditLogRow>
      sensitivity_acks: Table<SensitivityAckRow>
      invitations: Table<InvitationRow>
      students: Table<StudentRow>
      room_reservation_rules: Table<RoomReservationRuleRow>
      ai_cache: Table<AiCacheRow>
      ai_usage_logs: Table<AiUsageLogRow>
      budget_lines: Table<BudgetLineRow>
      budget_expenses: Table<BudgetExpenseRow>
      behavior_categories: Table<BehaviorCategoryRow>
      pbs_records: Table<PbsRecordRow>
    }
    Views: Empty
    Functions: Empty
    Enums: {
      user_role: UserRole
      course_level: CourseLevel
      employment_type: EmploymentType
      booking_kind: BookingKind
      booking_status: BookingStatus
      absence_reason: AbsenceReason
      substitution_status: SubstitutionStatus
      event_scope: EventScope
      event_category: EventCategory
    }
    CompositeTypes: Empty
  }
}
