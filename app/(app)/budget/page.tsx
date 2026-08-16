import { RealtimeRefresh } from '@/components/realtime-refresh'
import { Card, EmptyState, PageHeader } from '@/components/ui'
import { formatWon } from '@/lib/format'
import { createClient, isAdmin, requireSession } from '@/lib/supabase/server'
import { BudgetLineFormModal } from './budget-line-form-modal'
import { ExpenseFormModal } from './expense-form-modal'
import { ExpenseList, type ExpenseItem } from './expense-list'

export default async function BudgetPage() {
  const session = await requireSession()
  const fiscalYear = new Date().getFullYear()
  const supabase = await createClient()

  const [{ data: lines }, { data: expenses }, { data: departments }, { data: classes }, { data: staff }] =
    await Promise.all([
      supabase
        .from('budget_lines')
        .select('*')
        .eq('school_id', session.school.id)
        .eq('fiscal_year', fiscalYear)
        .order('created_at'),
      supabase
        .from('budget_expenses')
        .select('*')
        .eq('school_id', session.school.id)
        .order('created_at', { ascending: false }),
      supabase.from('departments').select('id, name').eq('school_id', session.school.id).order('name'),
      supabase
        .from('classes')
        .select('id, name')
        .eq('school_id', session.school.id)
        .order('grade'),
      supabase.from('profiles').select('id, name').eq('school_id', session.school.id),
    ])

  const departmentName = new Map((departments ?? []).map((d) => [d.id, d.name]))
  const className = new Map((classes ?? []).map((c) => [c.id, c.name]))
  const staffName = new Map((staff ?? []).map((s) => [s.id, s.name]))
  const visibleExpenses = (expenses ?? []).filter((expense) => expense.status !== 'rejected')

  const targetLabel = (line: { scope: string; department_id: string | null; class_id: string | null }) =>
    line.scope === 'department'
      ? (departmentName.get(line.department_id ?? '') ?? '부서')
      : (className.get(line.class_id ?? '') ?? '학급')

  // 항목별 등록된 지출 합. 과거 반려 기록은 집행액에서 제외한다.
  const registeredByLine = new Map<string, number>()
  for (const expense of visibleExpenses) {
    if (expense.status !== 'approved') continue
    registeredByLine.set(
      expense.budget_line_id,
      (registeredByLine.get(expense.budget_line_id) ?? 0) + expense.amount,
    )
  }

  // 부서별 집행률 — 부서 단위로 배정된 항목만 모은다
  const deptTotals = new Map<string, { name: string; allocated: number; spent: number }>()
  for (const line of lines ?? []) {
    if (line.scope !== 'department' || !line.department_id) continue
    const entry = deptTotals.get(line.department_id) ?? {
      name: departmentName.get(line.department_id) ?? '부서',
      allocated: 0,
      spent: 0,
    }
    entry.allocated += line.allocated_amount
    entry.spent += registeredByLine.get(line.id) ?? 0
    deptTotals.set(line.department_id, entry)
  }

  const lineNameById = new Map((lines ?? []).map((l) => [l.id, l.name]))
  const expenseItems: ExpenseItem[] = visibleExpenses.map((e) => ({
    id: e.id,
    budgetLineName: lineNameById.get(e.budget_line_id) ?? '(삭제된 항목)',
    requesterName: (e.requested_by && staffName.get(e.requested_by)) || '알 수 없음',
    amount: e.amount,
    description: e.description,
    spentOn: e.spent_on,
    receiptPath: e.receipt_path,
    canDelete: e.requested_by === session.userId || isAdmin(session.profile),
  }))

  return (
    <>
      <RealtimeRefresh schoolId={session.school.id} tables={['budget_lines', 'budget_expenses']} />
      <PageHeader
        title="학급·부서 예산"
        description={`${fiscalYear}년 예산 배정과 지출 등록 현황입니다.`}
        actions={
          <>
            {isAdmin(session.profile) ? (
              <BudgetLineFormModal
                departments={departments ?? []}
                classes={(classes ?? []).map((c) => ({ id: c.id, name: c.name }))}
              />
            ) : null}
            <ExpenseFormModal
              budgetLines={(lines ?? []).map((l) => ({
                id: l.id,
                label: `${targetLabel(l)} · ${l.name}`,
              }))}
            />
          </>
        }
      />

      {deptTotals.size > 0 ? (
        <Card className="mb-4 p-4">
          <h2 className="mb-3 text-[17px] font-semibold">부서별 집행률</h2>
          <ul className="space-y-3">
            {Array.from(deptTotals.values()).map((dept) => {
              const rate = dept.allocated > 0 ? Math.min(100, Math.round((dept.spent / dept.allocated) * 100)) : 0
              return (
                <li key={dept.name}>
                  <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5">
                    <span className="text-[15px] font-medium">{dept.name}</span>
                    <span className="tabular text-[13.5px] text-ink-soft">
                      {formatWon(dept.spent)} / {formatWon(dept.allocated)} ({rate}%)
                    </span>
                  </div>
                  <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-canvas">
                    <div className="h-full rounded-full bg-brand" style={{ width: `${rate}%` }} />
                  </div>
                </li>
              )
            })}
          </ul>
        </Card>
      ) : null}

      <Card className="mb-4">
        <h2 className="border-b border-line px-4 py-3 text-[17px] font-semibold">예산 항목</h2>
        {(lines ?? []).length === 0 ? (
          <EmptyState
            title="아직 예산 항목이 없습니다"
            hint={isAdmin(session.profile) ? '예산 항목 추가로 배정을 먼저 만들어 주세요' : '관리자가 예산을 배정하면 여기 나타납니다'}
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[560px] text-left text-[15px]">
              <thead>
                <tr className="border-b border-line text-[13.5px] text-ink-soft">
                  <th className="px-4 py-2 font-medium">배정 대상</th>
                  <th className="px-4 py-2 font-medium">항목</th>
                  <th className="px-4 py-2 font-medium">배정액</th>
                  <th className="px-4 py-2 font-medium">등록 집행액</th>
                  <th className="px-4 py-2 font-medium">잔액</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {(lines ?? []).map((line) => {
                  const spent = registeredByLine.get(line.id) ?? 0
                  const remaining = line.allocated_amount - spent
                  return (
                    <tr key={line.id}>
                      <td className="whitespace-nowrap px-4 py-2 text-ink-soft">{targetLabel(line)}</td>
                      <td className="px-4 py-2">{line.name}</td>
                      <td className="tabular whitespace-nowrap px-4 py-2">{formatWon(line.allocated_amount)}</td>
                      <td className="tabular whitespace-nowrap px-4 py-2">{formatWon(spent)}</td>
                      <td
                        className={`tabular whitespace-nowrap px-4 py-2 font-medium ${remaining < 0 ? 'text-danger' : ''}`}
                      >
                        {formatWon(remaining)}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <Card>
        <h2 className="border-b border-line px-4 py-3 text-[17px] font-semibold">지출 등록 내역</h2>
        <ExpenseList items={expenseItems} />
      </Card>
    </>
  )
}
