import { format, parseISO } from 'date-fns'
import { redirect } from 'next/navigation'
import { Card, EmptyState, PageHeader } from '@/components/ui'
import { formatKoreanDateWithDay, todayString } from '@/lib/date'
import { formatSpan } from '@/lib/scheduling/time'
import { createClient, isAdmin, requireSession } from '@/lib/supabase/server'
import { MonthPicker } from './month-picker'

export default async function PayrollPage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string }>
}) {
  const session = await requireSession()
  if (!isAdmin(session.profile)) redirect('/substitutions')

  const params = await searchParams
  const month = /^\d{4}-\d{2}$/.test(params.month ?? '')
    ? params.month!
    : format(parseISO(todayString()), 'yyyy-MM')

  const from = `${month}-01`
  const to = format(
    new Date(Number(month.slice(0, 4)), Number(month.slice(5, 7)), 0),
    'yyyy-MM-dd',
  )

  const supabase = await createClient()
  const [{ data: rows }, { data: profiles }, { data: classes }] = await Promise.all([
    supabase
      .from('substitution_assignments')
      .select('*')
      .eq('is_paid', true)
      .gte('assign_date', from)
      .lte('assign_date', to)
      .order('assign_date'),
    supabase.from('profiles').select('id, name').eq('school_id', session.school.id),
    supabase.from('classes').select('id, name').eq('school_id', session.school.id),
  ])

  const nameById = new Map((profiles ?? []).map((p) => [p.id, p.name]))
  const classById = new Map((classes ?? []).map((c) => [c.id, c.name]))

  const totals = new Map<string, number>()
  for (const row of rows ?? []) {
    if (!row.assigned_teacher_id) continue
    totals.set(row.assigned_teacher_id, (totals.get(row.assigned_teacher_id) ?? 0) + 1)
  }

  return (
    <>
      <PageHeader
        title="강사료 정산"
        description="시간강사가 맡은 결보강만 모았습니다. 내려받아 정산 서류에 붙이세요."
        actions={
          (rows ?? []).length > 0 ? (
            <a
              href={`/api/export/payroll?month=${month}`}
              className="inline-flex h-9 items-center rounded-lg border border-line bg-surface px-3.5 text-sm font-medium hover:bg-canvas"
            >
              CSV 내려받기
            </a>
          ) : null
        }
      />

      <MonthPicker month={month} />

      <div className="mt-4 grid gap-4 lg:grid-cols-[1fr_280px]">
        <Card>
          <h2 className="border-b border-line px-4 py-3 text-sm font-semibold">
            상세 {(rows ?? []).length > 0 ? (rows ?? []).length : ''}
          </h2>
          {(rows ?? []).length === 0 ? (
            <EmptyState title="이 달에는 정산할 결보강이 없습니다" />
          ) : (
            <ul className="divide-y divide-line">
              {(rows ?? []).map((row) => (
                <li key={row.id} className="flex flex-wrap items-baseline gap-x-3 px-4 py-2.5 text-sm">
                  <span className="text-xs text-ink-soft tabular">
                    {formatKoreanDateWithDay(row.assign_date)}
                  </span>
                  <span className="text-xs text-ink-soft tabular">
                    {row.period_no}교시{' '}
                    {formatSpan({ startsMin: row.starts_min, endsMin: row.ends_min })}
                  </span>
                  <span className="font-medium">
                    {row.assigned_teacher_id
                      ? (nameById.get(row.assigned_teacher_id) ?? '')
                      : '미배정'}
                  </span>
                  <span className="text-xs text-ink-soft">
                    {(row.class_id && classById.get(row.class_id)) || ''}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card className="h-fit">
          <h2 className="border-b border-line px-4 py-3 text-sm font-semibold">사람별 합계</h2>
          {totals.size === 0 ? (
            <EmptyState title="없습니다" />
          ) : (
            <ul className="divide-y divide-line">
              {[...totals.entries()]
                .sort((a, b) => b[1] - a[1])
                .map(([teacherId, count]) => (
                  <li key={teacherId} className="flex justify-between px-4 py-2.5 text-sm">
                    <span>{nameById.get(teacherId)}</span>
                    <span className="tabular font-medium">{count}시간</span>
                  </li>
                ))}
            </ul>
          )}
        </Card>
      </div>
    </>
  )
}
