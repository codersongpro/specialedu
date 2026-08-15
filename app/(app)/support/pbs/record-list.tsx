'use client'

import { useState } from 'react'
import { Badge, EmptyState } from '@/components/ui'
import { deleteRecord } from './actions'

export interface RecordItem {
  id: string
  studentName: string
  categoryName: string
  occurredAt: string
  location: string | null
  antecedent: string | null
  consequence: string | null
  note: string | null
  recordedByName: string
  canDelete: boolean
}

export function RecordList({ items }: { items: RecordItem[] }) {
  if (items.length === 0) {
    return <EmptyState title="아직 기록이 없습니다" hint="위에서 학생과 행동유형을 골라 기록해 보세요" />
  }

  return (
    <ul className="divide-y divide-line">
      {items.map((item) => (
        <RecordRow key={item.id} item={item} />
      ))}
    </ul>
  )
}

function RecordRow({ item }: { item: RecordItem }) {
  const [open, setOpen] = useState(false)
  const hasDetail = Boolean(item.antecedent || item.consequence || item.note)
  const when = new Date(item.occurredAt)

  return (
    <li className="px-4 py-3">
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <span className="whitespace-nowrap text-[15px] font-medium">{item.studentName}</span>
        <Badge tone="brand">{item.categoryName}</Badge>
        <span className="whitespace-nowrap text-[13.5px] text-ink-soft tabular">
          {when.toLocaleString('ko-KR', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
        </span>
        {item.location ? (
          <span className="whitespace-nowrap text-[13.5px] text-ink-soft">{item.location}</span>
        ) : null}
        <span className="whitespace-nowrap text-[13px] text-ink-soft">기록: {item.recordedByName}</span>
      </div>

      <div className="mt-1.5 flex flex-wrap items-center gap-2">
        {hasDetail ? (
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            className="text-[13.5px] text-brand underline"
          >
            {open ? '접기' : '자세히 보기'}
          </button>
        ) : null}
        {item.canDelete ? (
          <form action={deleteRecord}>
            <input type="hidden" name="id" value={item.id} />
            <button type="submit" className="text-[13.5px] text-ink-soft underline hover:text-danger">
              삭제
            </button>
          </form>
        ) : null}
      </div>

      {open ? (
        <div className="mt-2 space-y-1 rounded-lg bg-canvas px-3 py-2 text-[13.5px]">
          {item.antecedent ? <p>선행사건: {item.antecedent}</p> : null}
          {item.consequence ? <p>결과: {item.consequence}</p> : null}
          {item.note ? <p>메모: {item.note}</p> : null}
        </div>
      ) : null}
    </li>
  )
}
