'use client'

import { useState, useTransition } from 'react'
import { Button, inputClass } from '@/components/ui'
import { cn } from '@/lib/cn'
import type { CourseLevel } from '@/lib/scheduling/types'
import { minutesToTime } from '@/lib/school/default-periods'
import { savePeriods } from './actions'

const COURSE_TABS: Array<{ value: CourseLevel; label: string }> = [
  { value: 'elementary', label: '초등' },
  { value: 'middle', label: '중학' },
  { value: 'high', label: '고등' },
  { value: 'vocational', label: '전공과' },
]

interface Row {
  periodNo: number
  label: string
  start: string // "HH:MM"
  end: string
  isAfterschool: boolean
}

function toMinutes(time: string): number {
  const [h, m] = time.split(':').map(Number)
  return (h ?? 0) * 60 + (m ?? 0)
}

export function PeriodsForm({
  periodsByCourse,
}: {
  periodsByCourse: Record<CourseLevel, Row[]>
}) {
  const [course, setCourse] = useState<CourseLevel>('elementary')
  const [rowsByCourse, setRowsByCourse] = useState(periodsByCourse)
  const [pending, startTransition] = useTransition()
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null)

  const rows = rowsByCourse[course]

  function updateRows(next: Row[]) {
    setRowsByCourse((prev) => ({ ...prev, [course]: next }))
    setMessage(null)
  }

  function updateRow(index: number, patch: Partial<Row>) {
    updateRows(rows.map((row, i) => (i === index ? { ...row, ...patch } : row)))
  }

  function addRow() {
    const nextNo = rows.length > 0 ? Math.max(...rows.map((r) => r.periodNo)) + 1 : 1
    const last = rows[rows.length - 1]
    const start = last ? toMinutes(last.end) + 10 : 9 * 60
    updateRows([
      ...rows,
      {
        periodNo: nextNo,
        label: `${nextNo}교시`,
        start: minutesToTime(start),
        end: minutesToTime(start + 40),
        isAfterschool: false,
      },
    ])
  }

  function removeRow(index: number) {
    updateRows(rows.filter((_, i) => i !== index))
  }

  function save() {
    startTransition(async () => {
      const result = await savePeriods(
        course,
        rows.map((row) => ({
          periodNo: row.periodNo,
          label: row.label,
          startsMin: toMinutes(row.start),
          endsMin: toMinutes(row.end),
          isAfterschool: row.isAfterschool,
        })),
      )
      setMessage(
        result.ok ? { ok: true, text: '저장했습니다' } : { ok: false, text: result.error ?? '저장하지 못했습니다' },
      )
    })
  }

  return (
    <div>
      <div className="flex gap-1">
        {COURSE_TABS.map((tab) => (
          <button
            key={tab.value}
            type="button"
            onClick={() => {
              setCourse(tab.value)
              setMessage(null)
            }}
            className={cn(
              'rounded-lg px-3 py-1.5 text-sm transition-colors',
              tab.value === course ? 'bg-brand-soft font-medium text-brand' : 'text-ink-soft hover:bg-canvas',
            )}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div className="mt-3 space-y-2">
        {rows.length === 0 ? (
          <p className="text-sm text-ink-soft">교시가 없습니다. 아래 버튼으로 추가하세요.</p>
        ) : (
          rows.map((row, index) => (
            <div key={index} className="flex flex-wrap items-center gap-2">
              <input
                value={row.label}
                onChange={(e) => updateRow(index, { label: e.target.value })}
                maxLength={20}
                className={cn(inputClass, 'h-9 w-24 text-sm')}
              />
              <input
                type="time"
                value={row.start}
                onChange={(e) => updateRow(index, { start: e.target.value })}
                className={cn(inputClass, 'h-9 w-32 text-sm')}
              />
              <span className="text-ink-soft">~</span>
              <input
                type="time"
                value={row.end}
                onChange={(e) => updateRow(index, { end: e.target.value })}
                className={cn(inputClass, 'h-9 w-32 text-sm')}
              />
              <label className="flex items-center gap-1.5 text-[13px] text-ink-soft">
                <input
                  type="checkbox"
                  checked={row.isAfterschool}
                  onChange={(e) => updateRow(index, { isAfterschool: e.target.checked })}
                />
                방과후
              </label>
              <button
                type="button"
                onClick={() => removeRow(index)}
                className="ml-auto rounded-lg px-2 py-1 text-[13px] text-ink-soft underline hover:text-danger"
              >
                삭제
              </button>
            </div>
          ))
        )}
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <Button variant="secondary" onClick={addRow}>
          교시 추가
        </Button>
        <Button onClick={save} disabled={pending}>
          {pending ? '저장 중' : '이 과정 저장'}
        </Button>
        {message ? (
          <span className={cn('text-[13.5px]', message.ok ? 'text-ok' : 'text-danger')}>{message.text}</span>
        ) : null}
      </div>
    </div>
  )
}
