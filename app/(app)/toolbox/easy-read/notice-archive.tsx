'use client'

import { useState, useTransition } from 'react'
import { Card, EmptyState } from '@/components/ui'
import { deleteNotice } from './actions'

export interface NoticeArchiveItem {
  id: string
  noticeType: string
  title: string
  eventDate: string | null
  place: string | null
  audience: string
  detail: string
  output: string
  createdByName: string
  canDelete: boolean
  createdAt: string
}

export function NoticeArchive({ items }: { items: NoticeArchiveItem[] }) {
  return (
    <Card className="mt-4">
      <h2 className="border-b border-line px-4 py-3 text-sm font-semibold">저장된 안내문</h2>
      {items.length === 0 ? (
        <EmptyState title="아직 저장된 안내문이 없습니다" hint="안내문을 만든 뒤 저장하기를 누르면 여기 쌓입니다" />
      ) : (
        <ul className="divide-y divide-line">
          {items.map((item) => (
            <NoticeRow key={item.id} item={item} />
          ))}
        </ul>
      )}
    </Card>
  )
}

function NoticeRow({ item }: { item: NoticeArchiveItem }) {
  const [open, setOpen] = useState(false)
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [removed, setRemoved] = useState(false)

  if (removed) return null

  return (
    <li className="px-4 py-3">
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <span className="rounded bg-canvas px-1.5 py-0.5 text-xs font-medium text-ink-soft">{item.noticeType}</span>
        <span className="whitespace-nowrap text-[15px] font-medium">{item.title}</span>
        {item.eventDate || item.place ? (
          <span className="whitespace-nowrap text-[13.5px] text-ink-soft">
            {item.eventDate}
            {item.eventDate && item.place ? ' · ' : ''}
            {item.place}
          </span>
        ) : null}
        <span className="whitespace-nowrap text-[13px] text-ink-soft">대상: {item.audience}</span>
        <span className="whitespace-nowrap text-[13px] text-ink-soft">작성: {item.createdByName}</span>
      </div>

      <div className="mt-1.5 flex flex-wrap items-center gap-2">
        <button type="button" onClick={() => setOpen((v) => !v)} className="text-[13.5px] text-brand underline">
          {open ? '접기' : '자세히 보기'}
        </button>
        {item.canDelete ? (
          <button
            type="button"
            disabled={pending}
            onClick={() =>
              startTransition(async () => {
                const result = await deleteNotice(item.id)
                if (result.error) setError(result.error)
                else setRemoved(true)
              })
            }
            className="text-[13.5px] text-ink-soft underline hover:text-danger"
          >
            삭제
          </button>
        ) : null}
      </div>

      {error ? <p className="mt-1 text-[13px] text-danger">{error}</p> : null}

      {open ? (
        <div className="mt-2 space-y-2 rounded-lg bg-canvas px-3 py-2 text-[13.5px]">
          <p>
            <span className="font-medium">원문: </span>
            {item.detail || '(없음)'}
          </p>
          <p className="whitespace-pre-wrap">
            <span className="font-medium">결과: </span>
            {item.output}
          </p>
        </div>
      ) : null}
    </li>
  )
}
