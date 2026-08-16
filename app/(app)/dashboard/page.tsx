import Link from 'next/link'
import { Badge, Card, EmptyState, PageHeader } from '@/components/ui'
import { formatKoreanDate, formatKoreanDateWithDay, isoDayOfWeek, shiftDays, todayString } from '@/lib/date'
import { getCurrentTerm, loadScheduleContext } from '@/lib/data/context'
import { formatSpan } from '@/lib/scheduling/time'
import { BOOKING_KIND_LABEL } from '@/lib/scheduling/types'
import { createClient, isAdmin, requireSession } from '@/lib/supabase/server'

type WorkItem = {
  id: string
  title: string
  detail: string
  href: string
}

export default async function DashboardPage() {
  const session = await requireSession()
  const today = todayString()
  const supabase = await createClient()
  const term = await getCurrentTerm(supabase, session.school.id)

  if (!term) {
    return (
      <>
        <PageHeader title={`${session.profile.name} 선생님, 안녕하세요`} />
        <Card className="p-6 text-sm text-ink-soft">
          학기가 아직 등록되지 않았습니다. 관리자가 학년도와 학기를 넣으면 오늘 일정이 보입니다.
        </Card>
      </>
    )
  }

  const ctx = await loadScheduleContext(supabase, {
    schoolId: session.school.id,
    termId: term.id,
    fromDate: today,
    toDate: today,
  })

  const dayOfWeek = isoDayOfWeek(today)

  const myLessons = ctx.slots
    .filter(
      (s) =>
        s.dayOfWeek === dayOfWeek &&
        (s.teacherId === session.userId || s.coTeacherId === session.userId),
    )
    .sort((a, b) => a.startsMin - b.startsMin)

  const myReservations = ctx.reservations
    .filter(
      (r) =>
        r.reservedDate === today &&
        r.status !== 'cancelled' &&
        r.status !== 'rejected' &&
        (r.requesterId === session.userId || r.coTeacherId === session.userId),
    )
    .sort((a, b) => a.startsMin - b.startsMin)

  const isSchoolAdmin = isAdmin(session.profile)
  const soon = shiftDays(today, 7)
  const recent = shiftDays(today, -7)
  const [{ data: mySubs }, { data: events }, { data: upcomingEvents }, { data: myUpcomingReservations }, { data: myRecentExpenses }, { data: pendingAssignments }, { data: pendingReservations }, { data: pendingExpenses }, { data: expiringInvitations }] = await Promise.all([
    supabase
      .from('substitution_assignments')
      .select('*')
      .eq('assign_date', today)
      .eq('assigned_teacher_id', session.userId)
      .order('starts_min'),
    supabase
      .from('academic_events')
      .select('*')
      .lte('starts_on', today)
      .gte('ends_on', today)
      .order('starts_on'),
    supabase
      .from('academic_events')
      .select('id, title, starts_on')
      .gte('starts_on', today)
      .lte('starts_on', soon)
      .order('starts_on')
      .limit(5),
    supabase
      .from('room_reservations')
      .select('id, reserved_date, period_no, status')
      .eq('requester_id', session.userId)
      .gte('reserved_date', today)
      .not('status', 'in', '(cancelled,rejected)')
      .order('reserved_date')
      .limit(5),
    supabase
      .from('budget_expenses')
      .select('id, description, created_at')
      .eq('requested_by', session.userId)
      .gte('created_at', `${recent}T00:00:00.000Z`)
      .order('created_at', { ascending: false })
      .limit(5),
    isSchoolAdmin
      ? supabase
          .from('substitution_assignments')
          .select('id, assign_date, period_no')
          .eq('school_id', session.school.id)
          .eq('status', 'pending')
          .gte('assign_date', today)
          .order('assign_date')
          .limit(5)
      : Promise.resolve({ data: [] }),
    isSchoolAdmin
      ? supabase
          .from('room_reservations')
          .select('id, reserved_date, period_no')
          .eq('school_id', session.school.id)
          .eq('status', 'pending')
          .order('reserved_date')
          .limit(5)
      : Promise.resolve({ data: [] }),
    isSchoolAdmin
      ? supabase
          .from('budget_expenses')
          .select('id, description')
          .eq('school_id', session.school.id)
          .eq('status', 'pending')
          .order('created_at')
          .limit(5)
      : Promise.resolve({ data: [] }),
    isSchoolAdmin
      ? supabase
          .from('invitations')
          .select('id, name, expires_at')
          .eq('school_id', session.school.id)
          .gte('expires_at', new Date().toISOString())
          .lte('expires_at', `${soon}T23:59:59.999Z`)
          .order('expires_at')
          .limit(5)
      : Promise.resolve({ data: [] }),
  ])

  const needsAction: WorkItem[] = [
    ...(pendingAssignments ?? []).map((assignment) => ({
      id: `sub-${assignment.id}`,
      title: '결보강 배정 필요',
      detail: `${formatKoreanDate(assignment.assign_date)} ${assignment.period_no}교시`,
      href: '/substitutions',
    })),
    ...(pendingReservations ?? []).map((reservation) => ({
      id: `room-${reservation.id}`,
      title: '특별실 예약 확인 필요',
      detail: `${formatKoreanDate(reservation.reserved_date)} ${reservation.period_no}교시`,
      href: '/rooms',
    })),
    ...(pendingExpenses ?? []).map((expense) => ({
      id: `budget-${expense.id}`,
      title: '예산 등록 확인 필요',
      detail: expense.description,
      href: '/budget',
    })),
  ]

  const dueSoon: WorkItem[] = [
    ...(expiringInvitations ?? []).map((invitation) => ({
      id: `invite-${invitation.id}`,
      title: `${invitation.name} 선생님 초대 만료 임박`,
      detail: `${invitation.expires_at.slice(0, 10)}까지`,
      href: '/admin',
    })),
    ...(upcomingEvents ?? []).map((event) => ({
      id: `event-${event.id}`,
      title: event.title,
      detail: `${formatKoreanDate(event.starts_on)} 예정`,
      href: '/calendar',
    })),
  ]

  const recentlyCompleted: WorkItem[] = [
    ...(myUpcomingReservations ?? []).map((reservation) => ({
      id: `my-room-${reservation.id}`,
      title: '특별실 예약 등록',
      detail: `${formatKoreanDate(reservation.reserved_date)} ${reservation.period_no}교시`,
      href: '/rooms',
    })),
    ...(myRecentExpenses ?? []).map((expense) => ({
      id: `my-budget-${expense.id}`,
      title: '예산 등록 완료',
      detail: expense.description,
      href: '/budget',
    })),
  ]

  return (
    <>
      <PageHeader
        title={`${session.profile.name} 선생님, 안녕하세요`}
        description={`${formatKoreanDateWithDay(today)} 오늘 일정입니다.`}
      />

      <Card className="mb-4">
        <div className="border-b border-line px-4 py-3">
          <h2 className="text-[17px] font-semibold">통합 업무함</h2>
          <p className="mt-0.5 text-[13.5px] text-ink-soft">원본 업무 화면으로 바로 이동합니다.</p>
        </div>
        <div className="grid divide-y divide-line lg:grid-cols-3 lg:divide-x lg:divide-y-0">
          <WorkList title="내 처리 필요" items={needsAction} empty="처리할 업무가 없습니다" />
          <WorkList title="기한 임박" items={dueSoon} empty="7일 안에 잡힌 항목이 없습니다" />
          <WorkList title="최근 완료" items={recentlyCompleted} empty="최근 등록한 업무가 없습니다" />
        </div>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <SectionTitle title="오늘 수업" count={myLessons.length} />
          {myLessons.length === 0 ? (
            <EmptyState title="오늘 배정된 수업이 없습니다" />
          ) : (
            <ul className="divide-y divide-line">
              {myLessons.map((lesson) => (
                <li key={lesson.id} className="flex flex-wrap items-baseline gap-x-3 gap-y-1 px-4 py-3 text-base">
                  <span className="w-24 shrink-0 whitespace-nowrap text-[15px] text-ink-soft tabular">
                    {formatSpan(lesson)}
                  </span>
                  <span className="font-medium">
                    {(lesson.classId && ctx.classes.get(lesson.classId)?.name) ||
                      (lesson.courseGroupId && ctx.groups.get(lesson.courseGroupId)?.name) ||
                      '수업'}
                  </span>
                  {lesson.roomId ? (
                    <span className="whitespace-nowrap text-[15px] text-ink-soft">
                      {ctx.rooms.get(lesson.roomId)?.name}
                    </span>
                  ) : null}
                  {lesson.coTeacherId ? <Badge tone="brand">협력</Badge> : null}
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card>
          <SectionTitle
            title="내 특별실 예약"
            count={myReservations.length}
            href="/rooms"
            linkLabel="예약하러 가기"
          />
          {myReservations.length === 0 ? (
            <EmptyState title="오늘 잡아 둔 특별실이 없습니다" />
          ) : (
            <ul className="divide-y divide-line">
              {myReservations.map((r) => (
                <li key={r.id} className="flex flex-wrap items-baseline gap-x-3 gap-y-1 px-4 py-3 text-base">
                  <span className="w-24 shrink-0 whitespace-nowrap text-[15px] text-ink-soft tabular">
                    {formatSpan(r)}
                  </span>
                  <span className="font-medium">{ctx.rooms.get(r.roomId)?.name}</span>
                  <span className="whitespace-nowrap text-[15px] text-ink-soft">{BOOKING_KIND_LABEL[r.kind]}</span>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card>
          <SectionTitle
            title="내가 맡은 결보강"
            count={mySubs?.length ?? 0}
            href="/substitutions"
            linkLabel="전체 보기"
          />
          {!mySubs || mySubs.length === 0 ? (
            <EmptyState title="오늘 맡은 결보강이 없습니다" />
          ) : (
            <ul className="divide-y divide-line">
              {mySubs.map((sub) => (
                <li key={sub.id} className="flex flex-wrap items-baseline gap-x-3 gap-y-1 px-4 py-3 text-base">
                  <span className="w-24 shrink-0 whitespace-nowrap text-[15px] text-ink-soft tabular">
                    {formatSpan({ startsMin: sub.starts_min, endsMin: sub.ends_min })}
                  </span>
                  <span className="font-medium">
                    {(sub.class_id && ctx.classes.get(sub.class_id)?.name) || '수업'}
                  </span>
                  {sub.room_id ? (
                    <span className="whitespace-nowrap text-[15px] text-ink-soft">
                      {ctx.rooms.get(sub.room_id)?.name}
                    </span>
                  ) : null}
                  {sub.status === 'pending' ? <Badge tone="warn">확정 전</Badge> : null}
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card>
          <SectionTitle
            title="오늘 행사"
            count={events?.length ?? 0}
            href="/calendar"
            linkLabel="일정 보기"
          />
          {!events || events.length === 0 ? (
            <EmptyState title="오늘 잡힌 행사가 없습니다" />
          ) : (
            <ul className="divide-y divide-line">
              {events.map((event) => (
                <li key={event.id} className="px-4 py-3 text-base">
                  <span className="font-medium">{event.title}</span>
                  {event.detail ? (
                    <span className="ml-2 text-[15px] text-ink-soft">{event.detail}</span>
                  ) : null}
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </>
  )
}

function WorkList({ title, items, empty }: { title: string; items: WorkItem[]; empty: string }) {
  return (
    <section>
      <h3 className="px-4 pt-3 text-sm font-semibold">
        {title}
        {items.length > 0 ? <span className="ml-1.5 font-normal text-ink-soft">{items.length}</span> : null}
      </h3>
      {items.length === 0 ? (
        <p className="px-4 pb-4 pt-2 text-[13.5px] text-ink-soft">{empty}</p>
      ) : (
        <ul className="px-2 pb-2 pt-1">
          {items.map((item) => (
            <li key={item.id}>
              <Link href={item.href} className="block rounded-lg px-2 py-2 hover:bg-canvas">
                <span className="block text-sm font-medium">{item.title}</span>
                <span className="block text-[13px] text-ink-soft">{item.detail}</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}

function SectionTitle({
  title,
  count,
  href,
  linkLabel,
}: {
  title: string
  count: number
  href?: string
  linkLabel?: string
}) {
  return (
    <div className="flex items-center justify-between border-b border-line px-4 py-3">
      <h2 className="text-[17px] font-semibold">
        {title}
        {count > 0 ? <span className="ml-1.5 font-normal text-ink-soft">{count}</span> : null}
      </h2>
      {href ? (
        <Link href={href} className="text-[15px] font-semibold text-brand">
          {linkLabel}
        </Link>
      ) : null}
    </div>
  )
}
