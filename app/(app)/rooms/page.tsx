import { PageHeader } from '@/components/ui'
import { isoDayOfWeek, todayString } from '@/lib/date'
import { getCurrentTerm, loadScheduleContext, periodsFor } from '@/lib/data/context'
import type { CourseLevel } from '@/lib/scheduling/types'
import { createClient, isAdmin, requireSession } from '@/lib/supabase/server'
import { RoomBoard } from './room-board'

const COURSES: CourseLevel[] = ['elementary', 'middle', 'high', 'vocational']

function parseCourse(value: string | undefined): CourseLevel {
  return COURSES.includes(value as CourseLevel) ? (value as CourseLevel) : 'elementary'
}

export default async function RoomsPage({
  searchParams,
}: {
  searchParams: Promise<{ date?: string; course?: string }>
}) {
  const session = await requireSession()
  const params = await searchParams

  const date = /^\d{4}-\d{2}-\d{2}$/.test(params.date ?? '') ? params.date! : todayString()
  const course = parseCourse(params.course)

  const supabase = await createClient()
  const term = await getCurrentTerm(supabase, session.school.id)

  if (!term) {
    return (
      <>
        <PageHeader title="특별실 예약" />
        <p className="rounded-xl border border-line bg-surface p-6 text-sm text-ink-soft">
          학기가 등록되지 않았습니다. 관리자 &gt; 학교 관리에서 학년도와 학기를 먼저 넣어 주세요.
        </p>
      </>
    )
  }

  const ctx = await loadScheduleContext(supabase, {
    schoolId: session.school.id,
    termId: term.id,
    fromDate: date,
    toDate: date,
  })

  const dayOfWeek = isoDayOfWeek(date)
  const periods = periodsFor(ctx.periods, course)

  // 화면에서도 같은 충돌 검사 함수를 쓰려고 필요한 만큼만 넘긴다.
  const payload = {
    date,
    course,
    dayOfWeek,
    rooms: [...ctx.rooms.values()],
    classes: [...ctx.classes.values()],
    groups: [...ctx.groups.values()],
    teacherNames: Object.fromEntries(ctx.teacherNames),
    periods: periods.map((p) => ({
      periodNo: p.period_no,
      label: p.label,
      startsMin: p.starts_min,
      endsMin: p.ends_min,
      isAfterschool: p.is_afterschool,
    })),
    reservations: ctx.reservations,
    slots: ctx.slots.filter((s) => s.dayOfWeek === dayOfWeek),
    blackouts: ctx.blackouts,
    me: { id: session.userId, name: session.profile.name, isAdmin: isAdmin(session.profile) },
  }

  return (
    <>
      <PageHeader
        title="특별실 예약"
        description="빈 칸을 누르면 예약할 수 있습니다. 겹치는 일정이 있으면 바로 알려 줍니다."
      />
      <RoomBoard {...payload} />
    </>
  )
}
