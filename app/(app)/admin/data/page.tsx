import { redirect } from 'next/navigation'
import { PageHeader } from '@/components/ui'
import { createClient, isAdmin, requireSession } from '@/lib/supabase/server'
import { DataTabs } from './data-tabs'

export default async function AdminDataPage() {
  const session = await requireSession()
  if (!isAdmin(session.profile)) redirect('/dashboard')

  const supabase = await createClient()
  const [{ data: staff }, { data: departments }, { data: subjects }, { data: classes }, { data: rooms }, { data: students }] =
    await Promise.all([
      supabase.from('profiles').select('id, name').eq('school_id', session.school.id).order('name'),
      supabase.from('departments').select('id, name, head_id').eq('school_id', session.school.id).order('name'),
      supabase.from('subjects').select('id, name').eq('school_id', session.school.id).order('name'),
      supabase
        .from('classes')
        .select('id, course, grade, name, homeroom_teacher_id, assistant_teacher_id, student_count')
        .eq('school_id', session.school.id)
        .order('grade'),
      supabase
        .from('rooms')
        .select('id, name, room_type, floor, capacity, features, managed_by, requires_approval, is_active')
        .eq('school_id', session.school.id)
        .order('name'),
      supabase
        .from('students')
        .select('id, class_id, student_code, display_name, is_active')
        .eq('school_id', session.school.id)
        .order('student_code'),
    ])

  return (
    <>
      <PageHeader
        title="기준정보 관리"
        description="부서·교과·학급·특별실·학생 — 예약·시간표·결보강·예산·PBS 기록이 전부 이 데이터를 씁니다."
      />
      <div className="rounded-[14px] border border-line bg-surface p-5">
        <DataTabs
          staff={(staff ?? []).map((s) => ({ id: s.id, name: s.name }))}
          departments={(departments ?? []).map((d) => ({ id: d.id, name: d.name, headId: d.head_id }))}
          subjects={subjects ?? []}
          classes={(classes ?? []).map((c) => ({
            id: c.id,
            course: c.course,
            grade: c.grade,
            name: c.name,
            homeroomTeacherId: c.homeroom_teacher_id,
            assistantTeacherId: c.assistant_teacher_id,
            studentCount: c.student_count,
          }))}
          rooms={(rooms ?? []).map((r) => ({
            id: r.id,
            name: r.name,
            roomType: r.room_type,
            floor: r.floor,
            capacity: r.capacity,
            features: r.features,
            managedBy: r.managed_by,
            requiresApproval: r.requires_approval,
            isActive: r.is_active,
          }))}
          students={(students ?? []).map((s) => ({
            id: s.id,
            classId: s.class_id,
            studentCode: s.student_code,
            displayName: s.display_name,
            isActive: s.is_active,
          }))}
        />
      </div>
    </>
  )
}
