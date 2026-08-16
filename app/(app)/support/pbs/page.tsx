import { format, subWeeks } from 'date-fns'
import { RealtimeRefresh } from '@/components/realtime-refresh'
import { Card, EmptyState, PageHeader } from '@/components/ui'
import { formatKoreanDateWithDay, shiftDays, toDateString, weekStart } from '@/lib/date'
import { sortClassesByCourseGrade } from '@/lib/school/class-order'
import { AUDIT_ACTIONS, writeAudit } from '@/lib/security/audit'
import { decryptSecret } from '@/lib/security/crypto'
import { createClient, requireSession } from '@/lib/supabase/server'
import { RecordList } from './record-list'
import { RecordPanel } from './record-panel'
import { TrendChart, type TrendWeek } from './trend-chart'

export default async function PbsPage() {
  const session = await requireSession()
  const supabase = await createClient()

  const [{ data: classes }, { data: students }, { data: categories }, { data: records }] =
    await Promise.all([
      supabase
        .from('classes')
        .select('id, name, course, grade')
        .eq('school_id', session.school.id),
      supabase
        .from('students')
        .select('id, display_name, class_id')
        .eq('school_id', session.school.id)
        .eq('is_active', true)
        .order('display_name'),
      supabase
        .from('behavior_categories')
        .select('id, name')
        .eq('school_id', session.school.id)
        .eq('is_active', true)
        .order('sort_order'),
      supabase
        .from('pbs_records')
        .select('*')
        .eq('school_id', session.school.id)
        .gte('occurred_at', subWeeks(new Date(), 8).toISOString())
        .order('occurred_at', { ascending: false }),
    ])

  // 조회 자체를 감사로그에 남긴다 — 무엇을 봤는지가 아니라 누가 언제 이
  // 구역에 들어왔는지만
  await writeAudit({
    schoolId: session.school.id,
    actorId: session.userId,
    actorName: session.profile.name,
    action: AUDIT_ACTIONS.pbsRecordView,
    targetTable: 'pbs_records',
  })

  const studentName = new Map((students ?? []).map((s) => [s.id, s.display_name]))
  const categoryName = new Map((categories ?? []).map((c) => [c.id, c.name]))
  const staffIds = Array.from(new Set((records ?? []).map((r) => r.recorded_by).filter(Boolean))) as string[]
  const { data: staff } =
    staffIds.length > 0
      ? await supabase.from('profiles').select('id, name').in('id', staffIds)
      : { data: [] }
  const staffName = new Map((staff ?? []).map((s) => [s.id, s.name]))

  const recentRecords = (records ?? []).slice(0, 30).map((r) => ({
    id: r.id,
    studentName: studentName.get(r.student_id) ?? '알 수 없음',
    categoryName: r.category_id ? (categoryName.get(r.category_id) ?? '기타') : '기타',
    occurredAt: r.occurred_at,
    location: r.location,
    antecedent: safeDecrypt(r.antecedent_enc),
    consequence: safeDecrypt(r.consequence_enc),
    note: safeDecrypt(r.note_enc),
    recordedByName: (r.recorded_by && staffName.get(r.recorded_by)) || '알 수 없음',
    canDelete: r.recorded_by === session.userId || session.profile.role === 'admin' || session.profile.role === 'manager',
  }))

  // 최근 8주 — 주별 건수
  const weeks: TrendWeek[] = Array.from({ length: 8 }, (_, i) => {
    const start = shiftDays(toDateString(weekStart(new Date())), (i - 7) * 7)
    const end = shiftDays(start, 6)
    const count = (records ?? []).filter((r) => {
      const day = r.occurred_at.slice(0, 10)
      return day >= start && day <= end
    }).length
    return {
      label: format(new Date(start), 'M/d'),
      rangeLabel: `${formatKoreanDateWithDay(start)} ~ ${formatKoreanDateWithDay(end)}`,
      count,
    }
  })

  return (
    <>
      <RealtimeRefresh schoolId={session.school.id} tables={['pbs_records']} />
      <PageHeader
        title="PBS 기록"
        description="학생 행동을 탭 한 번으로 기록하고, 추세를 확인합니다."
      />

      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="p-5">
          <h2 className="text-sm font-semibold">기록하기</h2>
          {(classes ?? []).length === 0 ? (
            <EmptyState title="등록된 학급이 없습니다" />
          ) : (
            <div className="mt-3">
              <RecordPanel
                classes={sortClassesByCourseGrade(classes ?? [])}
                students={(students ?? []).map((s) => ({
                  id: s.id,
                  displayName: s.display_name,
                  classId: s.class_id,
                }))}
                categories={categories ?? []}
              />
            </div>
          )}
        </Card>

        <Card className="p-5">
          <h2 className="text-sm font-semibold">최근 8주 추세 (학교 전체)</h2>
          <div className="mt-3">
            <TrendChart weeks={weeks} />
          </div>
        </Card>
      </div>

      <Card className="mt-4">
        <h2 className="border-b border-line px-4 py-3 text-sm font-semibold">최근 기록</h2>
        <RecordList items={recentRecords} />
      </Card>
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
