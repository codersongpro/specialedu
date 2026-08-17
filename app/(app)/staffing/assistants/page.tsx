import { Badge, Card, EmptyState, PageHeader } from '@/components/ui'
import { getCurrentTerm } from '@/lib/data/context'
import { loadStaffingContext } from '@/lib/data/staffing'
import { checkCoverage } from '@/lib/staffing/coverage'
import { isAdmin, createClient, requireSession } from '@/lib/supabase/server'
import { StaffingPanel } from './staffing-panel'

export default async function AssistantsPage() {
  const session = await requireSession()
  const supabase = await createClient()

  const term = await getCurrentTerm(supabase, session.school.id)
  if (!term) {
    return (
      <>
        <PageHeader title="보조인력 배치" />
        <Card className="p-6 text-sm text-ink-soft">학기를 먼저 등록해야 합니다.</Card>
      </>
    )
  }

  const [{ data: periods }, ctx] = await Promise.all([
    supabase.from('periods').select('*').eq('school_id', session.school.id).order('period_no'),
    loadStaffingContext(supabase, { schoolId: session.school.id, termId: term.id }),
  ])

  const { warnings, coveredCount } = checkCoverage(ctx.needs, ctx.staff, ctx.assignments)
  const gapCount = warnings.filter((w) => w.kind !== 'double_booked').length
  const dupCount = warnings.filter((w) => w.kind === 'double_booked').length

  return (
    <>
      <PageHeader
        title="보조인력 배치"
        description="실무사 등 보조인력의 근무 가능 시간과 학급이 지원을 필요로 하는 시간을 맞춰 보고, 비거나 겹치는 곳을 확인합니다."
      />

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <Badge tone={gapCount > 0 ? 'warn' : 'ok'}>공백 {gapCount}건</Badge>
        <Badge tone={dupCount > 0 ? 'danger' : 'ok'}>중복 {dupCount}건</Badge>
        <span className="text-sm text-ink-soft">정상 배치 {coveredCount}건</span>
      </div>

      {ctx.classes.length === 0 ? (
        <Card className="p-6">
          <EmptyState
            title="등록된 학급이 없습니다"
            hint="설정 > 기준정보 관리에서 학급을 먼저 등록하세요"
          />
        </Card>
      ) : ctx.staff.length === 0 ? (
        <Card className="p-6">
          <EmptyState
            title="등록된 보조인력이 없습니다"
            hint="설정 > 교직원 초대에서 역할을 '실무사'로 초대하세요"
          />
        </Card>
      ) : (
        <StaffingPanel
          schoolId={session.school.id}
          termId={term.id}
          isAdmin={isAdmin(session.profile)}
          classes={ctx.classes}
          staff={ctx.staff.map((s) => ({ profileId: s.profileId, name: s.name }))}
          needs={ctx.needs}
          assignments={ctx.assignments}
          warnings={warnings}
          availabilityRows={ctx.availabilityRows}
          periods={(periods ?? []).map((p) => ({
            id: p.id,
            course: p.course,
            periodNo: p.period_no,
            label: p.label,
            startsMin: p.starts_min,
            endsMin: p.ends_min,
          }))}
        />
      )}
    </>
  )
}
