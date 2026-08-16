import { Card, EmptyState, PageHeader } from '@/components/ui'
import { getCurrentTerm, loadScheduleContext, periodsFor } from '@/lib/data/context'
import { todayString } from '@/lib/date'
import { sortClassesByCourseGrade } from '@/lib/school/class-order'
import { formatSpan } from '@/lib/scheduling/time'
import { COURSE_LABEL, type CourseLevel } from '@/lib/scheduling/types'
import { createClient, requireSession } from '@/lib/supabase/server'
import { TimetableFilter } from './timetable-filter'

const DAYS = [
  { value: 1, label: '월' },
  { value: 2, label: '화' },
  { value: 3, label: '수' },
  { value: 4, label: '목' },
  { value: 5, label: '금' },
]

export default async function TimetablePage({
  searchParams,
}: {
  searchParams: Promise<{ classId?: string; teacherId?: string }>
}) {
  const session = await requireSession()
  const params = await searchParams
  const supabase = await createClient()

  const term = await getCurrentTerm(supabase, session.school.id)
  if (!term) {
    return (
      <>
        <PageHeader title="시간표" />
        <Card className="p-6 text-sm text-ink-soft">학기를 먼저 등록해야 합니다.</Card>
      </>
    )
  }

  const today = todayString()
  const ctx = await loadScheduleContext(supabase, {
    schoolId: session.school.id,
    termId: term.id,
    fromDate: today,
    toDate: today,
  })

  const { data: profiles } = await supabase
    .from('profiles')
    .select('id, name')
    .eq('school_id', session.school.id)
    .eq('is_active', true)
    .order('name')

  // 아무것도 안 고르면 내 시간표를 보여준다
  const teacherId = params.classId ? undefined : (params.teacherId ?? session.userId)
  const classId = params.classId

  const slots = ctx.slots.filter((s) =>
    classId
      ? s.classId === classId
      : s.teacherId === teacherId || s.coTeacherId === teacherId,
  )

  const selectedClass = classId ? ctx.classes.get(classId) : undefined
  const course: CourseLevel = selectedClass?.course ?? slots[0]?.course ?? 'elementary'
  const periods = periodsFor(ctx.periods, course)

  const title = classId
    ? (selectedClass?.name ?? '학급 시간표')
    : `${ctx.teacherNames.get(teacherId!) ?? '내'} 시간표`

  return (
    <>
      <PageHeader
        title="시간표"
        description={`${term.year}학년도 ${term.semester}학기${term.is_free_semester ? ' · 자유학기' : ''}`}
      />

      <TimetableFilter
        classes={sortClassesByCourseGrade([...ctx.classes.values()]).map((c) => ({
          id: c.id,
          name: c.name,
          course: c.course,
        }))}
        teachers={profiles ?? []}
        classId={classId}
        teacherId={classId ? undefined : teacherId}
      />

      <Card className="mt-4 overflow-x-auto">
        <h2 className="border-b border-line px-4 py-3 text-sm font-semibold">
          {title}
          <span className="ml-2 font-normal text-ink-soft">{COURSE_LABEL[course]}</span>
        </h2>

        {slots.length === 0 ? (
          <EmptyState title="등록된 수업이 없습니다" hint="관리자가 시간표를 올리면 여기에 나옵니다." />
        ) : (
          <table className="w-full min-w-[640px] border-collapse text-sm">
            <thead>
              <tr className="border-b border-line">
                <th className="px-3 py-2 text-left text-xs font-semibold text-ink-soft">교시</th>
                {DAYS.map((day) => (
                  <th key={day.value} className="px-2 py-2 text-left text-xs font-semibold">
                    {day.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {periods.map((period) => (
                <tr key={period.id} className="border-b border-line last:border-0">
                  <th className="px-3 py-2 text-left align-top">
                    <span className="block text-xs font-semibold">{period.label}</span>
                    <span className="block text-[11px] font-normal text-ink-soft tabular">
                      {formatSpan({ startsMin: period.starts_min, endsMin: period.ends_min })}
                    </span>
                  </th>
                  {DAYS.map((day) => {
                    const slot = slots.find(
                      (s) => s.dayOfWeek === day.value && s.periodNo === period.period_no,
                    )
                    return (
                      <td key={day.value} className="p-1 align-top">
                        {slot ? (
                          <div className="min-h-12 rounded-lg border border-line bg-canvas p-2">
                            <span className="block text-xs font-medium">
                              {(slot.classId && ctx.classes.get(slot.classId)?.name) ||
                                (slot.courseGroupId &&
                                  ctx.groups.get(slot.courseGroupId)?.name) ||
                                '수업'}
                            </span>
                            {slot.roomId ? (
                              <span className="block text-[11px] text-ink-soft">
                                {ctx.rooms.get(slot.roomId)?.name}
                              </span>
                            ) : null}
                            {slot.teacherId && classId ? (
                              <span className="block text-[11px] text-ink-soft">
                                {ctx.teacherNames.get(slot.teacherId)}
                              </span>
                            ) : null}
                          </div>
                        ) : (
                          <div className="min-h-12" />
                        )}
                      </td>
                    )
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>
    </>
  )
}
