import { PageHeader } from '@/components/ui'
import { AUDIT_ACTIONS, writeAudit } from '@/lib/security/audit'
import { decryptSecret } from '@/lib/security/crypto'
import { createClient, isAdmin, requireSession } from '@/lib/supabase/server'
import { SafetyPanel, type StudentGroup, type StudentOption } from './safety-panel'

export default async function SafetyPage() {
  const session = await requireSession()
  const supabase = await createClient()

  const [{ data: students }, { data: classes }, { data: protocols }] = await Promise.all([
    supabase
      .from('students')
      .select('id, class_id, display_name')
      .eq('school_id', session.school.id)
      .eq('is_active', true)
      .order('display_name'),
    supabase.from('classes').select('id, name').eq('school_id', session.school.id),
    supabase
      .from('safety_protocols')
      .select('*')
      .eq('school_id', session.school.id)
      .order('updated_at', { ascending: false }),
  ])

  // 조회 자체를 감사로그에 남긴다 — 학생 지원 구역의 다른 기능과 같은 원칙
  await writeAudit({
    schoolId: session.school.id,
    actorId: session.userId,
    actorName: session.profile.name,
    action: AUDIT_ACTIONS.safetyProtocolView,
    targetTable: 'safety_protocols',
  })

  const className = new Map((classes ?? []).map((c) => [c.id, c.name]))
  const studentInfo = new Map((students ?? []).map((s) => [s.id, s]))

  const groupsMap = new Map<string, StudentGroup>()
  for (const p of protocols ?? []) {
    const student = studentInfo.get(p.student_id)
    if (!student) continue
    let group = groupsMap.get(p.student_id)
    if (!group) {
      group = {
        studentId: p.student_id,
        studentName: student.display_name,
        className: (student.class_id && className.get(student.class_id)) || '미배정',
        protocols: [],
      }
      groupsMap.set(p.student_id, group)
    }
    let content = ''
    try {
      content = decryptSecret(p.content_enc)
    } catch {
      content = '(복호화 실패 — 관리자에게 문의하세요)'
    }
    group.protocols.push({
      id: p.id,
      studentId: p.student_id,
      category: p.category,
      title: p.title,
      content,
      updatedAt: p.updated_at,
    })
  }

  const studentOptions: StudentOption[] = (students ?? []).map((s) => ({
    id: s.id,
    displayName: s.display_name,
    className: (s.class_id && className.get(s.class_id)) || '미배정',
  }))

  return (
    <>
      <PageHeader
        title="안전 프로토콜"
        description="발작·알레르기·연하곤란 등 응급 시 즉시 확인해야 하는 대응 절차입니다."
      />
      <SafetyPanel
        groups={Array.from(groupsMap.values())}
        students={studentOptions}
        isAdmin={isAdmin(session.profile)}
      />
    </>
  )
}
