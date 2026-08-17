import { Card, EmptyState, PageHeader } from '@/components/ui'
import { loadEquipmentContext } from '@/lib/data/equipment'
import { createClient, isAdmin, requireSession } from '@/lib/supabase/server'
import { EquipmentPanel } from './equipment-panel'

export default async function EquipmentPage() {
  const session = await requireSession()
  const supabase = await createClient()
  const admin = isAdmin(session.profile)

  const ctx = await loadEquipmentContext(supabase, session.school.id)

  return (
    <>
      <PageHeader
        title="교구 대여"
        description="교구·보조공학기기를 등록하고 빌려 씁니다. 보유 수량 안에서는 여러 명이 같은 물건을 겹치는 기간에 나눠 빌릴 수 있습니다."
      />

      {ctx.items.length === 0 ? (
        <Card className="mb-4 p-6">
          <EmptyState
            title="등록된 교구가 없습니다"
            hint={admin ? '아래 "품목 추가"로 먼저 등록하세요' : '관리자에게 교구 등록을 요청하세요'}
          />
        </Card>
      ) : null}

      <EquipmentPanel
        schoolId={session.school.id}
        isAdmin={admin}
        myProfileId={session.userId}
        items={ctx.items}
        loans={ctx.loans}
        classes={ctx.classes}
      />
    </>
  )
}
