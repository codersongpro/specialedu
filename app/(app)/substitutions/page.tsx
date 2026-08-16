import { RealtimeRefresh } from '@/components/realtime-refresh'
import { Badge, Card, EmptyState, PageHeader } from '@/components/ui'
import { formatKoreanDateWithDay, isoDayOfWeek, todayString } from '@/lib/date'
import { getCurrentTerm } from '@/lib/data/context'
import { loadCandidates, loadWeights } from '@/lib/data/substitution'
import { formatSpan } from '@/lib/scheduling/time'
import { scoreCandidates } from '@/lib/substitution/score'
import { manualAssignmentOptions } from '@/lib/substitution/manual-assignment'
import { createClient, isAdmin, requireSession } from '@/lib/supabase/server'
import { AbsenceForm } from './absence-form'
import { AssignRow } from './assign-row'

const REASON_LABEL: Record<string, string> = {
  business_trip: '출장',
  sick: '병가',
  annual: '연가',
  training: '연수',
  official: '공가',
  other: '기타',
}

export default async function SubstitutionsPage() {
  const session = await requireSession()
  const supabase = await createClient()
  const admin = isAdmin(session.profile)
  const today = todayString()

  const term = await getCurrentTerm(supabase, session.school.id)
  if (!term) {
    return (
      <>
        <PageHeader title="결보강" />
        <Card className="p-6 text-sm text-ink-soft">학기를 먼저 등록해야 합니다.</Card>
      </>
    )
  }

  const [{ data: profiles }, { data: absences }, { data: assignments }, { data: classes }] =
    await Promise.all([
      supabase
        .from('profiles')
        .select('id, name, employment')
        .eq('school_id', session.school.id)
        .eq('is_active', true)
        .order('name'),
      supabase
        .from('absences')
        .select('*')
        .gte('ends_on', today)
        .order('starts_on')
        .limit(30),
      supabase
        .from('substitution_assignments')
        .select('*')
        .gte('assign_date', today)
        .order('assign_date')
        .order('starts_min'),
      supabase.from('classes').select('id, name').eq('school_id', session.school.id),
    ])

  const nameById = new Map((profiles ?? []).map((p) => [p.id, p.name]))
  const classNameById = new Map((classes ?? []).map((c) => [c.id, c.name]))
  const { weights, longRunThreshold } = await loadWeights(supabase, session.school.id)

  // 아직 사람이 안 정해진 건에 대해서만 후보를 계산한다.
  // 직접 선택 목록도 이 결과로 배정 가능 여부를 표시하므로 모든 미배정 건을 확인한다.
  const pending = (assignments ?? []).filter((a) => a.status === 'pending')
  const suggestionsByAssignment = new Map<
    string,
    Array<{ teacherId: string; name: string; score: number; reasons: string[]; isPaid: boolean }>
  >()
  const manualOptionsByAssignment = new Map<
    string,
    Array<{ teacherId: string; name: string; isAvailable: boolean; isPaid: boolean }>
  >()

  if (admin) {
    for (const assignment of pending) {
      const absence = (absences ?? []).find((a) => a.id === assignment.absence_id)
      if (!absence) continue

      const target = {
        date: assignment.assign_date,
        dayOfWeek: isoDayOfWeek(assignment.assign_date),
        course: assignment.course,
        grade: null,
        periodNo: assignment.period_no,
        startsMin: assignment.starts_min,
        endsMin: assignment.ends_min,
        subjectId: assignment.subject_id,
        classId: assignment.class_id,
        roomFloor: null,
        absentTeacherId: absence.teacher_id,
      }

      const candidates = await loadCandidates(supabase, {
        schoolId: session.school.id,
        termId: term.id,
        target,
      })

      const { ranked } = scoreCandidates(target, candidates, weights, longRunThreshold)
      suggestionsByAssignment.set(
        assignment.id,
        ranked.slice(0, 3).map((r) => ({
          teacherId: r.candidate.teacherId,
          name: r.candidate.name,
          score: r.score,
          reasons: r.breakdown.filter((b) => b.points > 0).map((b) => b.label),
          isPaid: r.isPaid,
        })),
      )
      manualOptionsByAssignment.set(
        assignment.id,
        manualAssignmentOptions(profiles ?? [], ranked),
      )
    }
  }

  return (
    <>
      <RealtimeRefresh
        schoolId={session.school.id}
        tables={['substitution_assignments', 'absences']}
      />
      <PageHeader
        title="결보강"
        description="결과를 신청하면 그 시간 수업을 자동으로 찾아 보강 후보를 뽑아 줍니다."
      />

      <div className="grid gap-4 lg:grid-cols-[1fr_340px]">
        <div className="space-y-4">
          <Card>
            <h2 className="border-b border-line px-4 py-3 text-sm font-semibold">
              보강이 필요한 수업
              {pending.length > 0 ? (
                <span className="ml-1.5 text-ink-soft">{pending.length}</span>
              ) : null}
            </h2>

            {(assignments ?? []).length === 0 ? (
              <EmptyState
                title="예정된 결보강이 없습니다"
                hint="오른쪽에서 결과를 신청하면 여기에 나옵니다."
              />
            ) : (
              <ul className="divide-y divide-line">
                {(assignments ?? []).map((assignment) => {
                  const absence = (absences ?? []).find((a) => a.id === assignment.absence_id)
                  return (
                    <AssignRow
                      key={assignment.id}
                      assignmentId={assignment.id}
                      date={formatKoreanDateWithDay(assignment.assign_date)}
                      span={formatSpan({
                        startsMin: assignment.starts_min,
                        endsMin: assignment.ends_min,
                      })}
                      periodLabel={`${assignment.period_no}교시`}
                      className={
                        (assignment.class_id && classNameById.get(assignment.class_id)) || '수업'
                      }
                      absentName={
                        absence ? (nameById.get(absence.teacher_id) ?? '') : ''
                      }
                      reason={absence ? (REASON_LABEL[absence.reason] ?? '') : ''}
                      assignedName={
                        assignment.assigned_teacher_id
                          ? (nameById.get(assignment.assigned_teacher_id) ?? '')
                          : null
                      }
                      isPaid={assignment.is_paid}
                      canAssign={admin}
                      suggestions={suggestionsByAssignment.get(assignment.id) ?? []}
                      manualOptions={manualOptionsByAssignment.get(assignment.id) ?? []}
                    />
                  )
                })}
              </ul>
            )}
          </Card>
        </div>

        <div className="space-y-4">
          <Card className="p-4">
            <h2 className="mb-3 text-sm font-semibold">결과 신청</h2>
            <AbsenceForm
              me={{ id: session.userId, name: session.profile.name }}
              teachers={profiles ?? []}
              canPickOthers={admin}
            />
          </Card>

          {admin ? (
            <Card className="p-4 text-xs leading-relaxed text-ink-soft">
              <p className="mb-1.5 font-semibold text-ink">배정 순위는 어떻게 정해지나요</p>
              <p>
                시간강사 우선, 같은 교과, 같은 과정·학년, 담임 여부, 이번 주 결보강 횟수,
                연강 여부를 점수로 매깁니다. 그 시간에 수업이 있는 분은 아예 빠집니다.
              </p>
              <p className="mt-2">
                점수 기준은 학교마다 다르니 관리자 &gt; 학교 관리에서 바꿀 수 있습니다.
              </p>
            </Card>
          ) : null}

          <Card className="p-4">
            <h2 className="mb-2 text-sm font-semibold">최근 결과 신청</h2>
            {(absences ?? []).length === 0 ? (
              <p className="text-sm text-ink-soft">없습니다</p>
            ) : (
              <ul className="space-y-2">
                {(absences ?? []).slice(0, 8).map((absence) => (
                  <li key={absence.id} className="flex flex-wrap items-baseline gap-x-2 gap-y-1 text-sm">
                    <span className="font-medium">{nameById.get(absence.teacher_id)}</span>
                    <Badge>{REASON_LABEL[absence.reason]}</Badge>
                    <span className="whitespace-nowrap text-xs text-ink-soft tabular">
                      {absence.starts_on === absence.ends_on
                        ? formatKoreanDateWithDay(absence.starts_on)
                        : `${absence.starts_on} ~ ${absence.ends_on}`}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>
      </div>
    </>
  )
}
