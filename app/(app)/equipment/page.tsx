import { Badge, Button, Card, EmptyState, PageHeader } from '@/components/ui'
import { RealtimeRefresh } from '@/components/realtime-refresh'
import { availableEquipmentQuantity } from '@/lib/equipment/availability'
import { createClient, isAdmin, requireSession } from '@/lib/supabase/server'
import { returnEquipmentLoan } from './actions'
import { EquipmentItemForm, EquipmentLoanForm } from './equipment-forms'

export default async function EquipmentPage() {
  const session = await requireSession()
  const supabase = await createClient()
  const admin = isAdmin(session.profile)
  const [{ data: items }, { data: loans }, { data: profiles }] = await Promise.all([
    supabase.from('equipment_items').select('*').eq('school_id', session.school.id).order('name'),
    supabase.from('equipment_loans').select('*').eq('school_id', session.school.id).order('created_at', { ascending: false }),
    supabase.from('profiles').select('id, name').eq('school_id', session.school.id),
  ])
  const nameById = new Map((profiles ?? []).map((profile) => [profile.id, profile.name]))
  const loansByItem = new Map<string, Array<{ quantity: number; returnedAt: string | null }>>()
  for (const loan of loans ?? []) {
    const grouped = loansByItem.get(loan.item_id) ?? []
    grouped.push({ quantity: loan.quantity, returnedAt: loan.returned_at })
    loansByItem.set(loan.item_id, grouped)
  }
  const itemRows = (items ?? []).map((item) => ({
    ...item,
    available: availableEquipmentQuantity(item.total_quantity, loansByItem.get(item.id) ?? []),
  }))
  const activeLoans = (loans ?? []).filter((loan) => !loan.returned_at)

  return <>
    <RealtimeRefresh schoolId={session.school.id} tables={['equipment_items', 'equipment_loans']} />
    <PageHeader title="교구 대여" description="교구·보조공학기기의 보관 위치와 대여·반납 현황을 관리합니다." actions={<><EquipmentLoanForm items={itemRows.filter((item) => item.condition === 'available' && item.available > 0)} />{admin ? <EquipmentItemForm /> : null}</>} />
    <div className="grid gap-4 lg:grid-cols-[1fr_360px]">
      <Card>
        <h2 className="border-b border-line px-4 py-3 text-sm font-semibold">보유 교구</h2>
        {!itemRows.length ? <EmptyState title="등록된 교구가 없습니다" hint="관리자가 교구와 보관 수량을 등록해 주세요." /> : <ul className="divide-y divide-line">{itemRows.map((item) => <li key={item.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3"><div><p className="font-medium">{item.name}</p><p className="mt-0.5 text-sm text-ink-soft">{[item.category, item.location].filter(Boolean).join(' · ') || '분류·위치 미입력'}</p></div><div className="flex items-center gap-2"><Badge tone={item.condition === 'available' ? 'ok' : 'warn'}>{item.condition === 'available' ? `${item.available}/${item.total_quantity}개 가능` : item.condition === 'repair' ? '수리 중' : '사용 종료'}</Badge></div></li>)}</ul>}
      </Card>
      <Card>
        <h2 className="border-b border-line px-4 py-3 text-sm font-semibold">현재 대여</h2>
        {!activeLoans.length ? <EmptyState title="대여 중인 교구가 없습니다" /> : <ul className="divide-y divide-line">{activeLoans.map((loan) => { const item = itemRows.find((entry) => entry.id === loan.item_id); const canReturn = admin || loan.borrower_id === session.userId; return <li key={loan.id} className="px-4 py-3"><p className="font-medium">{item?.name ?? '교구'} · {loan.quantity}개</p><p className="mt-0.5 text-sm text-ink-soft">{nameById.get(loan.borrower_id) ?? '알 수 없음'}{loan.due_on ? ` · ${loan.due_on}까지` : ''}</p>{canReturn ? <form action={returnEquipmentLoan} className="mt-2"><input type="hidden" name="id" value={loan.id} /><Button type="submit" variant="secondary" className="h-9 px-3 text-sm">반납 처리</Button></form> : null}</li> })}</ul>}
      </Card>
    </div>
  </>
}
