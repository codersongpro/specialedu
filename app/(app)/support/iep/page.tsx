import { Card, EmptyState, PageHeader } from '@/components/ui'
import { groupProgressByGoal, progressTrend } from '@/lib/iep/progress'
import { AUDIT_ACTIONS, writeAudit } from '@/lib/security/audit'
import { decryptSecret } from '@/lib/security/crypto'
import { createClient, isAdmin, requireSession } from '@/lib/supabase/server'
import { GoalPanel, type ClassInfo, type GoalItem, type StudentInfo } from './goal-panel'

export default async function IepPage() {
  const session = await requireSession()
  const supabase = await createClient()

  const [{ data: classes }, { data: students }, { data: goals }, { data: progress }] =
    await Promise.all([
      supabase
        .from('classes')
        .select('id, name')
        .eq('school_id', session.school.id)
        .order('grade'),
      supabase
        .from('students')
        .select('id, display_name, class_id')
        .eq('school_id', session.school.id)
        .eq('is_active', true)
        .order('display_name'),
      supabase
        .from('iep_goals')
        .select('*')
        .eq('school_id', session.school.id)
        .order('created_at', { ascending: false }),
      supabase
        .from('iep_progress')
        .select('*')
        .eq('school_id', session.school.id)
        .order('occurred_on', { ascending: false }),
    ])

  // 조회 자체를 감사로그에 남긴다 — PBS·안전 프로토콜과 같은 원칙
  await writeAudit({
    schoolId: session.school.id,
    actorId: session.userId,
    actorName: session.profile.name,
    action: AUDIT_ACTIONS.iepGoalView,
    targetTable: 'iep_goals',
  })

  const staffIds = Array.from(
    new Set(
      [...(goals ?? []).map((g) => g.created_by), ...(progress ?? []).map((p) => p.recorded_by)].filter(
        Boolean,
      ),
    ),
  ) as string[]
  const { data: staff } =
    staffIds.length > 0
      ? await supabase.from('profiles').select('id, name').in('id', staffIds)
      : { data: [] }
  const staffName = new Map((staff ?? []).map((s) => [s.id, s.name]))
  const canManage = (recordedOrCreatedBy: string | null) =>
    recordedOrCreatedBy === session.userId || isAdmin(session.profile)

  const progressRowById = new Map((progress ?? []).map((p) => [p.id, p]))
  const progressByGoal = groupProgressByGoal(
    (progress ?? []).map((p) => ({
      id: p.id,
      goalId: p.goal_id,
      occurredOn: p.occurred_on,
      level: p.level,
    })),
  )

  const goalItems: GoalItem[] = (goals ?? []).map((g) => {
    const rawProgress = progressByGoal.get(g.id) ?? []
    const progressItems = rawProgress.map((entry) => {
      const row = progressRowById.get(entry.id)!
      return {
        id: row.id,
        occurredOn: row.occurred_on,
        level: row.level,
        note: safeDecrypt(row.note_enc),
        recordedByName: (row.recorded_by && staffName.get(row.recorded_by)) || '알 수 없음',
        canDelete: canManage(row.recorded_by),
      }
    })
    return {
      id: g.id,
      studentId: g.student_id,
      area: g.area,
      title: g.title,
      termLabel: g.term_label,
      status: g.status,
      createdByName: (g.created_by && staffName.get(g.created_by)) || '알 수 없음',
      canEdit: canManage(g.created_by),
      progress: progressItems,
      trend: progressTrend(rawProgress),
    }
  })

  const classInfos: ClassInfo[] = (classes ?? []).map((c) => ({ id: c.id, name: c.name }))
  const studentInfos: StudentInfo[] = (students ?? []).map((s) => ({
    id: s.id,
    displayName: s.display_name,
    classId: s.class_id,
  }))

  return (
    <>
      <PageHeader
        title="IEP 목표"
        description="학생별 개별화교육계획 목표를 세우고 진도를 기록합니다."
      />
      {classInfos.length === 0 ? (
        <Card className="p-5">
          <EmptyState
            title="등록된 학급이 없습니다"
            hint="설정 > 기준정보 관리에서 학급과 학생을 먼저 등록하세요"
          />
        </Card>
      ) : (
        <GoalPanel classes={classInfos} students={studentInfos} goals={goalItems} />
      )}
    </>
  )
}

function safeDecrypt(value: string | null): string | null {
  if (!value) return null
  try {
    return decryptSecret(value)
  } catch {
    return null
  }
}
