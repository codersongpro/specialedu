import { addDays, endOfMonth, format, parseISO, startOfMonth } from 'date-fns'
import { Card, PageHeader } from '@/components/ui'
import { toDateString, todayString, weekDates, weekStart } from '@/lib/date'
import { createClient, requireSession } from '@/lib/supabase/server'
import { CalendarView } from './calendar-view'
import { EventForm } from './event-form'

export default async function CalendarPage({
  searchParams,
}: {
  searchParams: Promise<{ view?: string; date?: string; course?: string }>
}) {
  const session = await requireSession()
  const params = await searchParams

  const view = params.view === 'week' ? 'week' : 'month'
  const anchor = /^\d{4}-\d{2}-\d{2}$/.test(params.date ?? '') ? params.date! : todayString()

  // 월간은 앞뒤 주가 걸치므로 넉넉히 읽는다
  const [from, to] =
    view === 'week'
      ? [weekDates(anchor, 7)[0]!, weekDates(anchor, 7)[6]!]
      : [
          toDateString(addDays(weekStart(startOfMonth(parseISO(anchor))), 0)),
          toDateString(addDays(endOfMonth(parseISO(anchor)), 7)),
        ]

  const supabase = await createClient()
  const [{ data: events }, { data: classes }] = await Promise.all([
    supabase
      .from('academic_events')
      .select('*')
      .lte('starts_on', to)
      .gte('ends_on', from)
      .order('starts_on'),
    supabase
      .from('classes')
      .select('id, name, course, grade, homeroom_teacher_id, assistant_teacher_id')
      .eq('school_id', session.school.id)
      .order('grade'),
  ])

  const myClasses = (classes ?? []).filter(
    (c) =>
      c.homeroom_teacher_id === session.userId || c.assistant_teacher_id === session.userId,
  )

  return (
    <>
      <PageHeader
        title="학사일정·행사"
        description="학교 전체, 과정, 학년, 학급 일정을 한 화면에서 봅니다."
      />

      <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
        <CalendarView
          view={view}
          anchor={anchor}
          monthLabel={format(parseISO(anchor), 'yyyy년 M월')}
          events={(events ?? []).map((e) => ({
            id: e.id,
            title: e.title,
            detail: e.detail,
            startsOn: e.starts_on,
            endsOn: e.ends_on,
            scope: e.scope,
            scopeCourse: e.scope_course,
            scopeGrade: e.scope_grade,
            scopeClassId: e.scope_class_id,
            category: e.category,
            source: e.source,
          }))}
          classNames={Object.fromEntries((classes ?? []).map((c) => [c.id, c.name]))}
        />

        <Card className="h-fit p-4">
          <h2 className="mb-3 text-sm font-semibold">행사 넣기</h2>
          <EventForm
            classes={myClasses.map((c) => ({ id: c.id, name: c.name }))}
            allClasses={(classes ?? []).map((c) => ({ id: c.id, name: c.name }))}
            canPickAnyScope={session.profile.role === 'admin' || session.profile.role === 'manager'}
          />
        </Card>
      </div>
    </>
  )
}
