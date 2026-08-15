'use client'

import { useMemo } from 'react'
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
}

const CATEGORY_TONE: Record<string, string> = {
  academic: 'bg-brand-soft text-brand',
  grade_event: 'bg-ok-soft text-ok',
  course_event: 'bg-ok-soft text-ok',
  class_event: 'bg-canvas text-ink',
  exam: 'bg-warn-soft text-warn',
  vacation: 'bg-danger-soft text-danger',
  holiday: 'bg-danger-soft text-danger',
  training: 'bg-brand-soft text-brand',
  other: 'bg-canvas text-ink-soft',
}

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

export function CalendarView({
  view,
  anchor,
  monthLabel,
  events,
  classNames,
}: {
  view: 'week' | 'month'
  anchor: string
  monthLabel: string
  events: CalendarEvent[]
  classNames: Record<string, string>
}) {
  const router = useRouter()

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
                      <EventChip key={event.id} event={event} classNames={classNames} showDelete />
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
                        <EventChip key={event.id} event={event} classNames={classNames} compact />
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
    </Card>
  )
}

function EventChip({
  event,
  classNames,
  compact,
  showDelete,
}: {
  event: CalendarEvent
  classNames: Record<string, string>
  compact?: boolean
  showDelete?: boolean
}) {
  const scopeText =
    event.scope === 'class'
      ? (event.scopeClassId && classNames[event.scopeClassId]) || '학급'
      : event.scope === 'grade'
        ? `${COURSE_LABEL[event.scopeCourse ?? ''] ?? ''} ${event.scopeGrade}학년`
        : event.scope === 'course'
          ? (COURSE_LABEL[event.scopeCourse ?? ''] ?? '과정')
          : (SCOPE_LABEL[event.scope] ?? '')

  if (compact) {
    return (
      <span
        title={`${scopeText} · ${event.title}`}
        className={cn(
          'block truncate rounded px-1 py-0.5 text-[10px]',
          CATEGORY_TONE[event.category] ?? CATEGORY_TONE.other,
        )}
      >
        {event.title}
      </span>
    )
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <span
        className={cn(
          'rounded px-1.5 py-0.5 text-xs font-medium',
          CATEGORY_TONE[event.category] ?? CATEGORY_TONE.other,
        )}
      >
        {scopeText}
      </span>
      <span className="text-sm">{event.title}</span>
      {event.detail ? <span className="text-xs text-ink-soft">{event.detail}</span> : null}
      {event.source !== 'manual' ? (
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
