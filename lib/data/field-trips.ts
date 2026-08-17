import type { CourseLevel } from '@/lib/scheduling/types'
import type { TypedClient } from '@/lib/supabase/server'

/**
 * 현장체험학습 화면에 필요한 것을 한 번에 읽어 온다.
 * lib/data/staffing.ts와 같은 모양이다.
 */
export interface FieldTripInfo {
  id: string
  title: string
  destination: string | null
  startsOn: string
  endsOn: string
  scope: 'school' | 'course' | 'grade' | 'class' | 'department'
  scopeCourse: string | null
  scopeGrade: number | null
  scopeClassId: string | null
  scopeDepartmentId: string | null
  contactNote: string | null
  createdBy: string | null
}

export interface ChecklistItemInfo {
  id: string
  tripId: string
  label: string
  isChecked: boolean
}

export interface ChaperoneInfo {
  id: string
  tripId: string
  profileId: string
  profileName: string
  note: string | null
}

export interface FieldTripContext {
  trips: FieldTripInfo[]
  checklist: ChecklistItemInfo[]
  chaperones: ChaperoneInfo[]
  classes: Array<{ id: string; name: string; course: CourseLevel; grade: number }>
  departments: Array<{ id: string; name: string }>
  staff: Array<{ id: string; name: string }>
}

export async function loadFieldTripContext(
  supabase: TypedClient,
  schoolId: string,
): Promise<FieldTripContext> {
  const [tripsRes, checklistRes, chaperonesRes, classesRes, departmentsRes, staffRes] = await Promise.all([
    supabase
      .from('field_trips')
      .select(
        'id, title, destination, starts_on, ends_on, scope, scope_course, scope_grade, scope_class_id, scope_department_id, contact_note, created_by',
      )
      .eq('school_id', schoolId)
      .order('starts_on'),
    supabase
      .from('field_trip_checklist_items')
      .select('id, trip_id, label, is_checked')
      .eq('school_id', schoolId),
    supabase
      .from('field_trip_chaperones')
      .select('id, trip_id, profile_id, note')
      .eq('school_id', schoolId),
    supabase.from('classes').select('id, name, course, grade').eq('school_id', schoolId).order('grade'),
    supabase.from('departments').select('id, name').eq('school_id', schoolId).order('name'),
    supabase.from('profiles').select('id, name').eq('school_id', schoolId).eq('is_active', true).order('name'),
  ])

  const profileById = new Map((staffRes.data ?? []).map((p) => [p.id, p.name]))

  return {
    trips: (tripsRes.data ?? []).map((row) => ({
      id: row.id,
      title: row.title,
      destination: row.destination,
      startsOn: row.starts_on,
      endsOn: row.ends_on,
      scope: row.scope,
      scopeCourse: row.scope_course,
      scopeGrade: row.scope_grade,
      scopeClassId: row.scope_class_id,
      scopeDepartmentId: row.scope_department_id,
      contactNote: row.contact_note,
      createdBy: row.created_by,
    })),
    checklist: (checklistRes.data ?? []).map((row) => ({
      id: row.id,
      tripId: row.trip_id,
      label: row.label,
      isChecked: row.is_checked,
    })),
    chaperones: (chaperonesRes.data ?? []).map((row) => ({
      id: row.id,
      tripId: row.trip_id,
      profileId: row.profile_id,
      profileName: profileById.get(row.profile_id) ?? '(알 수 없음)',
      note: row.note,
    })),
    classes: (classesRes.data ?? []).map((c) => ({ id: c.id, name: c.name, course: c.course, grade: c.grade })),
    departments: (departmentsRes.data ?? []).map((d) => ({ id: d.id, name: d.name })),
    staff: (staffRes.data ?? []).map((p) => ({ id: p.id, name: p.name })),
  }
}
