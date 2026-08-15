'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { addDays, endOfMonth, format, isSameMonth, parseISO, startOfMonth } from 'date-fns'
import { Button, Card } from '@/components/ui'
import { cn } from '@/lib/cn'
import {
  formatKoreanDateWithDay,
  shiftMonths,
  shiftWeeks,
  toDateString,
  todayString,
  weekDates,
  weekStart,
} from '@/lib/date'
import { deleteEvent } from './actions'

export interface CalendarEvent {
  id: string
  title: string
  detail: string | null
  startsOn: string
  endsOn: string
  scope: string
  scopeCourse: string | null
  scopeGrade: number | null
  scopeClassId: string | null
  category: string
  source: string
  /** 특별실 예약을 캘린더에 함께 보여줄 때만 쓴다. 학사일정은 항상 'event'. */
  kind?: 'event' | 'reservation'
}

const CATEGORY_LABEL: Record<string, string> = {
  academic: '학사일정',
  grade_event: '학년행사',
  course_event: '과정행사',
  class_event: '학급행사',
  exam: '평가',
  vacation: '방학',
  holiday: '휴업일',
  training: '연수·협의회',
  other: '기타',
  room_reservation: '특별실 예약',
}

// 과정(초·중·고·전공과)마다 다른 색으로 보이게 한다. 전교·부서처럼 특정
// 과정에 속하지 않는 일정은 중립색(NEUTRAL_TONE)을 쓴다.
const COURSE_TONE: Record<string, string> = {
  elementary: 'bg-ok-soft text-ok',
  middle: 'bg-cyan-100 text-cyan-700',
  high: 'bg-brand-soft text-brand',
  vocational: 'bg-violet-100 text-violet-700',
}
const NEUTRAL_TONE = 'bg-canvas text-ink-soft'

const SCOPE_LABEL: Record<string, string> = {
  school: '전교',
  course: '과정',
  grade: '학년',
  class: '학급',
  department: '부서',
}

const COURSE_LABEL: Record<string, string> = {
  elementary: '초등',
  middle: '중학',
  high: '고등',
  vocational: '전공과',
}

const WEEKDAYS = ['월', '화', '수', '목', '금', '토', '일'] as const

/** class_id 로만 범위가 잡힌 행사는 scopeCourse 가 비어 있어, 학급의 과정을 따로 찾아야 한다 */
function courseOf(event: CalendarEvent, classCourses: Record<string, string>): string | null {
  if (event.scopeCourse) return event.scopeCourse
  if (event.scope === 'class' && event.scopeClassId) return classCourses[event.scopeClassId] ?? null
  return null
}

export function CalendarView({
  view,
  anchor,
  monthLabel,
  events,
  classNames,
  classCourses,
}: {
  view: 'week' | 'month'
  anchor: string
  monthLabel: string
  events: CalendarEvent[]
  classNames: Record<string, string>
  classCourses: Record<string, string>
}) {
  const router = useRouter()
  const [selected, setSelected] = useState<CalendarEvent | null>(null)

  function go(next: { view?: string; date?: string }) {
    const query = new URLSearchParams({
      view: next.view ?? view,
      date: next.date ?? anchor,
    })
    router.push(`/calendar?${query}`)
  }

  const days = useMemo(() => {
    if (view === 'week') return weekDates(anchor, 7)

    // 월간은 그 달을 감싸는 주 단위로 채운다
    const first = weekStart(startOfMonth(parseISO(anchor)))
    const last = endOfMonth(parseISO(anchor))
    const cells: string[] = []
    let cursor = first
    while (cursor <= last || cells.length % 7 !== 0) {
      cells.push(toDateString(cursor))
      cursor = addDays(cursor, 1)
      if (cells.length > 42) break
    }
    return cells
  }, [view, anchor])

  const byDate = useMemo(() => {
    const map = new Map<string, CalendarEvent[]>()
    for (const day of days) {
      map.set(
        day,
        events.filter((e) => e.startsOn <= day && day <= e.endsOn),
      )
    }
    return map
  }, [days, events])

  const today = todayString()

  return (
    <Card>
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line px-4 py-3">
        <div className="flex items-center gap-1.5">
          <Button
            variant="secondary"
            onClick={() =>
              go({ date: view === 'week' ? shiftWeeks(anchor, -1) : shiftMonths(anchor, -1) })
            }
          >
            이전
          </Button>
          <span className="min-w-28 text-center text-sm font-medium">
            {view === 'week' ? `${formatKoreanDateWithDay(days[0] ?? anchor)} 주` : monthLabel}
          </span>
          <Button
            variant="secondary"
            onClick={() =>
              go({ date: view === 'week' ? shiftWeeks(anchor, 1) : shiftMonths(anchor, 1) })
            }
          >
            다음
          </Button>
          <Button variant="secondary" onClick={() => go({ date: today })}>
            오늘
          </Button>
        </div>

        <div className="flex gap-1">
          {(['week', 'month'] as const).map((v) => (
            <button
              key={v}
              type="button"
              onClick={() => go({ view: v })}
              className={cn(
                'rounded-lg px-3 py-1.5 text-sm transition-colors',
                v === view ? 'bg-brand-soft font-medium text-brand' : 'text-ink-soft hover:bg-canvas',
              )}
            >
              {v === 'week' ? '주간' : '월간'}
            </button>
          ))}
        </div>
      </div>

      {view === 'week' ? (
        <ul className="divide-y divide-line">
          {days.map((day) => {
            const dayEvents = byDate.get(day) ?? []
            return (
              <li key={day} className="flex gap-4 px-4 py-3">
                <span
                  className={cn(
                    'w-24 shrink-0 text-sm tabular',
                    day === today ? 'font-semibold text-brand' : 'text-ink-soft',
                  )}
                >
                  {formatKoreanDateWithDay(day)}
                </span>
                <div className="min-w-0 flex-1 space-y-1.5">
                  {dayEvents.length === 0 ? (
                    <span className="text-sm text-ink-soft/60">—</span>
                  ) : (
                    dayEvents.map((event) => (
                      <EventChip
                        key={event.id}
                        event={event}
                        classNames={classNames}
                        classCourses={classCourses}
                        showDelete
                        onSelect={setSelected}
                      />
                    ))
                  )}
                </div>
              </li>
            )
          })}
        </ul>
      ) : (
        <div className="overflow-x-auto">
          <div className="min-w-[700px]">
            <div className="grid grid-cols-7 border-b border-line">
              {WEEKDAYS.map((label) => (
                <div
                  key={label}
                  className="px-2 py-2 text-center text-xs font-semibold text-ink-soft"
                >
                  {label}
                </div>
              ))}
            </div>
            <div className="grid grid-cols-7">
              {days.map((day) => {
                const dayEvents = byDate.get(day) ?? []
                const inMonth = isSameMonth(parseISO(day), parseISO(anchor))
                return (
                  <div
                    key={day}
                    className={cn(
                      'min-h-24 border-b border-r border-line p-1.5 last:border-r-0',
                      !inMonth && 'bg-canvas/60',
                    )}
                  >
                    <span
                      className={cn(
                        'text-xs tabular',
                        day === today
                          ? 'font-semibold text-brand'
                          : inMonth
                            ? 'text-ink-soft'
                            : 'text-ink-soft/50',
                      )}
                    >
                      {format(parseISO(day), 'd')}
                    </span>
                    <div className="mt-1 space-y-1">
                      {dayEvents.slice(0, 3).map((event) => (
                        <EventChip
                          key={event.id}
                          event={event}
                          classNames={classNames}
                          classCourses={classCourses}
                          compact
                          onSelect={setSelected}
                        />
                      ))}
                      {dayEvents.length > 3 ? (
                        <span className="block text-[10px] text-ink-soft">
                          외 {dayEvents.length - 3}건
                        </span>
                      ) : null}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      )}

      {selected ? (
        <EventDetailModal
          event={selected}
          classNames={classNames}
          classCourses={classCourses}
          onClose={() => setSelected(null)}
        />
      ) : null}
    </Card>
  )
}

function scopeTextOf(event: CalendarEvent, classNames: Record<string, string>): string {
  return event.scope === 'class'
    ? (event.scopeClassId && classNames[event.scopeClassId]) || '학급'
    : event.scope === 'grade'
      ? `${COURSE_LABEL[event.scopeCourse ?? ''] ?? ''} ${event.scopeGrade}학년`
      : event.scope === 'course'
        ? (COURSE_LABEL[event.scopeCourse ?? ''] ?? '과정')
        : (SCOPE_LABEL[event.scope] ?? '')
}

function EventChip({
  event,
  classNames,
  classCourses,
  compact,
  showDelete,
  onSelect,
}: {
  event: CalendarEvent
  classNames: Record<string, string>
  classCourses: Record<string, string>
  compact?: boolean
  showDelete?: boolean
  onSelect: (event: CalendarEvent) => void
}) {
  const scopeText = scopeTextOf(event, classNames)
  const course = courseOf(event, classCourses)
  const tone = course ? (COURSE_TONE[course] ?? NEUTRAL_TONE) : NEUTRAL_TONE

  if (compact) {
    return (
      <button
        type="button"
        title={`${scopeText} · ${event.title}`}
        onClick={() => onSelect(event)}
        className={cn('block w-full truncate rounded px-1 py-0.5 text-left text-[10px]', tone)}
      >
        {event.title}
      </button>
    )
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <button
        type="button"
        onClick={() => onSelect(event)}
        className="flex flex-wrap items-center gap-2 rounded text-left hover:opacity-80"
      >
        <span className={cn('rounded px-1.5 py-0.5 text-xs font-medium', tone)}>{scopeText}</span>
        <span className="text-sm">{event.title}</span>
      </button>
      {event.detail ? <span className="text-xs text-ink-soft">{event.detail}</span> : null}
      {event.kind !== 'reservation' && event.source !== 'manual' ? (
        <span className="text-[10px] text-ink-soft">나이스</span>
      ) : null}
      {showDelete && event.source === 'manual' ? (
        <form action={deleteEvent}>
          <input type="hidden" name="id" value={event.id} />
          <button type="submit" className="text-[11px] text-ink-soft underline hover:text-danger">
            삭제
          </button>
        </form>
      ) : null}
    </div>
  )
}

function EventDetailModal({
  event,
  classNames,
  classCourses,
  onClose,
}: {
  event: CalendarEvent
  classNames: Record<string, string>
  classCourses: Record<string, string>
  onClose: () => void
}) {
  const scopeText = scopeTextOf(event, classNames)
  const course = courseOf(event, classCourses)
  const tone = course ? (COURSE_TONE[course] ?? NEUTRAL_TONE) : NEUTRAL_TONE
  const dateText =
    event.startsOn === event.endsOn ? event.startsOn : `${event.startsOn} ~ ${event.endsOn}`

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-ink/40 px-4 py-8 sm:items-center"
      onClick={onClose}
    >
      <div
        className="w-full max-w-sm rounded-[14px] border border-line bg-surface p-4 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-3 flex items-start justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <span className={cn('rounded px-1.5 py-0.5 text-xs font-medium', tone)}>{scopeText}</span>
            <span className="rounded bg-canvas px-1.5 py-0.5 text-xs font-medium text-ink-soft">
              {CATEGORY_LABEL[event.category] ?? event.category}
            </span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="-mr-2 -mt-1 rounded-lg px-2 py-1 text-[15px] text-ink-soft hover:bg-canvas"
          >
            닫기
          </button>
        </div>

        <h2 className="text-[17px] font-semibold">{event.title}</h2>
        <p className="mt-1 tabular text-[15px] text-ink-soft">{dateText}</p>
        {event.detail ? <p className="mt-2 whitespace-pre-wrap text-[15px]">{event.detail}</p> : null}
        {event.kind === 'reservation' ? (
          <p className="mt-2 text-[13px] text-ink-soft">
            특별실 예약입니다. 취소하려면 특별실 예약 화면에서 하세요.
          </p>
        ) : event.source !== 'manual' ? (
          <p className="mt-2 text-[13px] text-ink-soft">나이스 학사일정에서 가져온 일정입니다.</p>
        ) : null}

        {event.source === 'manual' ? (
          <form
            action={deleteEvent}
            className="mt-4"
            onSubmit={onClose}
          >
            <input type="hidden" name="id" value={event.id} />
            <button type="submit" className="text-[13.5px] text-ink-soft underline hover:text-danger">
              이 일정 삭제
            </button>
          </form>
        ) : null}
      </div>
    </div>
  )
}
