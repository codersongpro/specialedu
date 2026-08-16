import Link from 'next/link'
import { Card, PageHeader } from '@/components/ui'
import { shiftDays, todayString, toDateString, weekStart } from '@/lib/date'
import { buildWeeklyBriefing } from '@/lib/workflow/weekly-briefing'
import { createClient, requireSession } from '@/lib/supabase/server'
import { AutomationForm } from './automation-form'

const TOOLS = [
  { id: 'document_checklist', title: '공문·매뉴얼 체크리스트', description: '일정·담당·준비물·확인 항목만 추립니다.' },
  { id: 'trip_plan', title: '행사·체험학습 운영표', description: '행사 준비와 귀교 확인을 한 장으로 정리합니다.' },
  { id: 'meeting_notes', title: '회의 메모 정리', description: '결정 사항·담당 업무·마감일을 정리합니다.' },
] as const

export default async function AutomationPage({ searchParams }: { searchParams: Promise<{ tool?: string }> }) {
  const session = await requireSession(); const supabase = await createClient(); const params = await searchParams
  const monday = toDateString(weekStart(todayString())); const friday = shiftDays(monday, 4)
  const [{ count: reservations }, { count: substitutions }, { count: expenses }, { data: events }, { count: lessons }] = await Promise.all([
    supabase.from('room_reservations').select('*', { count: 'exact', head: true }).eq('requester_id', session.userId).gte('reserved_date', monday).lte('reserved_date', friday),
    supabase.from('substitution_assignments').select('*', { count: 'exact', head: true }).eq('assigned_teacher_id', session.userId).gte('assign_date', monday).lte('assign_date', friday),
    supabase.from('budget_expenses').select('*', { count: 'exact', head: true }).eq('requested_by', session.userId).gte('spent_on', monday).lte('spent_on', friday),
    supabase.from('academic_events').select('title').lte('starts_on', friday).gte('ends_on', monday).order('starts_on'),
    supabase.from('timetable_slots').select('*', { count: 'exact', head: true }).eq('teacher_id', session.userId),
  ])
  const briefing = buildWeeklyBriefing({ weekStart: monday, lessons: (lessons ?? 0) * 5, reservations: reservations ?? 0, substitutions: substitutions ?? 0, events: (events ?? []).map((event) => event.title), budgetItems: expenses ?? 0 })
  const selected = TOOLS.find((tool) => tool.id === params.tool)
  return <><PageHeader title="업무 자동화" description="개인정보 없이 반복 업무를 빠르게 정리합니다." />{selected ? <><Link href="/toolbox/automation" className="mb-4 inline-block text-sm text-brand underline">자동화 도구 목록</Link><h2 className="mb-2 text-lg font-semibold">{selected.title}</h2><p className="mb-4 text-sm text-ink-soft">{selected.description}</p><AutomationForm tool={selected.id} /></> : <div className="space-y-4"><Card className="p-5"><h2 className="font-semibold">주간 업무 브리핑</h2><pre className="mt-3 whitespace-pre-wrap font-sans text-sm leading-7">{briefing}</pre></Card><div className="grid gap-4 md:grid-cols-3">{TOOLS.map((tool) => <Link key={tool.id} href={`/toolbox/automation?tool=${tool.id}`}><Card className="h-full p-5 transition hover:border-brand"><h2 className="font-semibold">{tool.title}</h2><p className="mt-2 text-sm text-ink-soft">{tool.description}</p></Card></Link>)}</div></div>}</>
}
