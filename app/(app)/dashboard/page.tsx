import Link from 'next/link'
import { Badge, Card, EmptyState, PageHeader } from '@/components/ui'
import { formatKoreanDateWithDay, isoDayOfWeek, todayString } from '@/lib/date'
import { getCurrentTerm, loadScheduleContext } from '@/lib/data/context'
import { formatSpan } from '@/lib/scheduling/time'
import { BOOKING_KIND_LABEL } from '@/lib/scheduling/types'
import { createClient, requireSession } from '@/lib/supabase/server'

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

  const [{ data: mySubs }, { data: events }] = await Promise.all([
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
  ])

  return (
    <>
      <PageHeader
        title={`${session.profile.name} 선생님, 안녕하세요`}
        description={`${formatKoreanDateWithDay(today)} 오늘 일정입니다.`}
      />

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <SectionTitle title="오늘 수업" count={myLessons.length} />
          {myLessons.length === 0 ? (
            <EmptyState title="오늘 배정된 수업이 없습니다" />
          ) : (
            <ul className="divide-y divide-line">
              {myLessons.map((lesson) => (
                <li key={lesson.id} className="flex items-baseline gap-3 px-4 py-2.5 text-sm">
                  <span className="w-24 shrink-0 text-xs text-ink-soft tabular">
                    {formatSpan(lesson)}
                  </span>
                  <span className="font-medium">
                    {(lesson.classId && ctx.classes.get(lesson.classId)?.name) ||
                      (lesson.courseGroupId && ctx.groups.get(lesson.courseGroupId)?.name) ||
                      '수업'}
                  </span>
                  {lesson.roomId ? (
                    <span className="text-xs text-ink-soft">
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
                <li key={r.id} className="flex items-baseline gap-3 px-4 py-2.5 text-sm">
                  <span className="w-24 shrink-0 text-xs text-ink-soft tabular">
                    {formatSpan(r)}
                  </span>
                  <span className="font-medium">{ctx.rooms.get(r.roomId)?.name}</span>
                  <span className="text-xs text-ink-soft">{BOOKING_KIND_LABEL[r.kind]}</span>
                  {r.status === 'pending' ? <Badge tone="warn">승인 대기</Badge> : null}
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
                <li key={sub.id} className="flex items-baseline gap-3 px-4 py-2.5 text-sm">
                  <span className="w-24 shrink-0 text-xs text-ink-soft tabular">
                    {formatSpan({ startsMin: sub.starts_min, endsMin: sub.ends_min })}
                  </span>
                  <span className="font-medium">
                    {(sub.class_id && ctx.classes.get(sub.class_id)?.name) || '수업'}
                  </span>
                  {sub.room_id ? (
                    <span className="text-xs text-ink-soft">
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
                <li key={event.id} className="px-4 py-2.5 text-sm">
                  <span className="font-medium">{event.title}</span>
                  {event.detail ? (
                    <span className="ml-2 text-xs text-ink-soft">{event.detail}</span>
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
      <h2 className="text-sm font-semibold">
        {title}
        {count > 0 ? <span className="ml-1.5 text-ink-soft">{count}</span> : null}
      </h2>
      {href ? (
        <Link href={href} className="text-xs text-brand">
          {linkLabel}
        </Link>
      ) : null}
    </div>
  )
}
