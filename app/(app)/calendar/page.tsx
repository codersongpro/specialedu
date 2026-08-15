import { addDays, endOfMonth, format, parseISO, startOfMonth } from 'date-fns'
import { RealtimeRefresh } from '@/components/realtime-refresh'
import { PageHeader } from '@/components/ui'
import { toDateString, todayString, weekDates, weekStart } from '@/lib/date'
import { createClient, requireSession } from '@/lib/supabase/server'
import { CalendarView } from './calendar-view'
import { EventFormModal } from './event-form-modal'

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
  const [{ data: events }, { data: classes }, { data: reservations }, { data: rooms }, { data: staff }] =
    await Promise.all([
      supabase
        .from('academic_events')
        .select('*')
        .lte('starts_on', to)
        .gte('ends_on', from)
        .order('starts_on'),
      supabase
        .from('classes')
        .select('id, name, course, grade')
        .eq('school_id', session.school.id)
        .order('grade'),
      supabase
        .from('room_reservations')
        .select('id, room_id, reserved_date, course, class_id, requester_id, status, purpose')
        .eq('school_id', session.school.id)
        .gte('reserved_date', from)
        .lte('reserved_date', to)
        .not('status', 'in', '(cancelled,rejected)'),
      supabase.from('rooms').select('id, name').eq('school_id', session.school.id),
      supabase.from('profiles').select('id, name').eq('school_id', session.school.id),
    ])

  const roomName = new Map((rooms ?? []).map((r) => [r.id, r.name]))
  const staffName = new Map((staff ?? []).map((s) => [s.id, s.name]))

  const reservationItems = (reservations ?? []).map((r) => {
    const requester = (r.requester_id && staffName.get(r.requester_id)) || '알 수 없음'
    return {
      id: `reservation:${r.id}`,
      title: `${roomName.get(r.room_id) ?? '특별실'}${r.status === 'pending' ? ' (승인 대기)' : ''}`,
      detail: `${requester}${r.purpose ? ` · ${r.purpose}` : ''}`,
      startsOn: r.reserved_date,
      endsOn: r.reserved_date,
      scope: r.class_id ? 'class' : 'course',
      scopeCourse: r.course,
      scopeGrade: null,
      scopeClassId: r.class_id,
      category: 'room_reservation',
      source: 'reservation',
      kind: 'reservation' as const,
    }
  })

  return (
    <>
      <RealtimeRefresh schoolId={session.school.id} tables={['academic_events', 'room_reservations']} />
      <PageHeader
        title="학사일정·행사"
        description="학교 전체, 과정, 학년, 학급 일정과 특별실 예약을 한 화면에서 봅니다."
        actions={
          <EventFormModal allClasses={(classes ?? []).map((c) => ({ id: c.id, name: c.name }))} />
        }
      />

      <CalendarView
        view={view}
        anchor={anchor}
        monthLabel={format(parseISO(anchor), 'yyyy년 M월')}
        events={[
          ...(events ?? []).map((e) => ({
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
          })),
          ...reservationItems,
        ]}
        classNames={Object.fromEntries((classes ?? []).map((c) => [c.id, c.name]))}
        classCourses={Object.fromEntries((classes ?? []).map((c) => [c.id, c.course]))}
      />
    </>
  )
}
