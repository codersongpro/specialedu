'use client'

import { useState } from 'react'
import { Badge, Button } from '@/components/ui'
import { assignSubstitute, clearAssignment } from './actions'

interface Suggestion {
  teacherId: string
  name: string
  score: number
  reasons: string[]
  isPaid: boolean
}

export function AssignRow({
  assignmentId,
  date,
  span,
  periodLabel,
  className,
  absentName,
  reason,
  assignedName,
  isPaid,
  canAssign,
  suggestions,
}: {
  assignmentId: string
  date: string
  span: string
  periodLabel: string
  className: string
  absentName: string
  reason: string
  assignedName: string | null
  isPaid: boolean
  canAssign: boolean
  suggestions: Suggestion[]
}) {
  const [open, setOpen] = useState(false)

  return (
    <li className="px-4 py-3">
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1 text-sm">
        <span className="whitespace-nowrap text-xs text-ink-soft tabular">{date}</span>
        <span className="whitespace-nowrap text-xs text-ink-soft tabular">
          {periodLabel} {span}
        </span>
        <span className="whitespace-nowrap font-medium">{className}</span>
        <span className="whitespace-nowrap text-xs text-ink-soft">
          {absentName} {reason}
        </span>

        <span className="ml-auto flex items-center gap-2">
          {assignedName ? (
            <>
              <Badge tone="ok">{assignedName}</Badge>
              {isPaid ? <Badge tone="brand">수당</Badge> : null}
              {canAssign ? (
                <form action={clearAssignment}>
                  <input type="hidden" name="assignmentId" value={assignmentId} />
                  <button
                    type="submit"
                    className="text-xs text-ink-soft underline hover:text-danger"
                  >
                    해제
                  </button>
                </form>
              ) : null}
            </>
          ) : canAssign ? (
            <Button variant="secondary" onClick={() => setOpen((v) => !v)}>
              {open ? '닫기' : '보강 정하기'}
            </Button>
          ) : (
            <Badge tone="warn">배정 전</Badge>
          )}
        </span>
      </div>

      {open && !assignedName ? (
        <div className="mt-3 rounded-lg border border-line bg-canvas p-3">
          {suggestions.length === 0 ? (
            <p className="text-sm text-ink-soft">
              이 시간에 가능한 분이 없습니다. 시간표나 출근 요일을 확인해 주세요.
            </p>
          ) : (
            <ul className="space-y-2">
              {suggestions.map((s, index) => (
                <li key={s.teacherId} className="flex flex-wrap items-center gap-2">
                  <span className="text-xs text-ink-soft tabular">{index + 1}</span>
                  <span className="text-sm font-medium">{s.name}</span>
                  {s.isPaid ? <Badge tone="brand">시간강사</Badge> : null}
                  <span className="text-xs text-ink-soft">{s.reasons.join(' · ')}</span>
                  <form action={assignSubstitute} className="ml-auto">
                    <input type="hidden" name="assignmentId" value={assignmentId} />
                    <input type="hidden" name="teacherId" value={s.teacherId} />
                    <input type="hidden" name="score" value={s.score} />
                    <input type="hidden" name="isPaid" value={s.isPaid ? '1' : '0'} />
                    <button
                      type="submit"
                      className="rounded-md border border-line bg-surface px-2 py-1 text-xs font-medium hover:bg-brand-soft hover:text-brand"
                    >
                      이 분으로
                    </button>
                  </form>
                </li>
              ))}
            </ul>
          )}
        </div>
      ) : null}
    </li>
  )
}
