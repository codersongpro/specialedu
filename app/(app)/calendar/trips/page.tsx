import { Card, EmptyState, PageHeader } from '@/components/ui'
import { loadFieldTripContext } from '@/lib/data/field-trips'
import { createClient, isAdmin, requireSession } from '@/lib/supabase/server'
import { TripsPanel } from './trips-panel'

export default async function FieldTripsPage() {
  const session = await requireSession()
  const supabase = await createClient()

  const ctx = await loadFieldTripContext(supabase, session.school.id)

  return (
    <>
      <PageHeader
        title="현장체험학습"
        description="일정·인솔 배치·안전 점검 체크리스트를 한 곳에서 관리합니다. 학사일정 캘린더에도 함께 표시됩니다."
      />

      {ctx.trips.length === 0 ? (
        <Card className="mb-4 p-6">
          <EmptyState title="등록된 현장체험학습이 없습니다" hint='아래 "체험학습 등록"으로 먼저 등록하세요' />
        </Card>
      ) : null}

      <TripsPanel
        schoolId={session.school.id}
        myProfileId={session.userId}
        isAdmin={isAdmin(session.profile)}
        trips={ctx.trips}
        checklist={ctx.checklist}
        chaperones={ctx.chaperones}
        classes={ctx.classes}
        departments={ctx.departments}
        staff={ctx.staff}
      />
    </>
  )
}
