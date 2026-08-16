'use client'

import { useState } from 'react'
import { Badge, EmptyState } from '@/components/ui'
import { formatWon } from '@/lib/format'
import { deleteExpense, getReceiptUrl } from './actions'

export interface ExpenseItem {
  id: string
  budgetLineName: string
  requesterName: string
  amount: number
  description: string
  spentOn: string
  receiptPath: string | null
  canDelete: boolean
}

export function ExpenseList({ items }: { items: ExpenseItem[] }) {
  if (items.length === 0) {
    return <EmptyState title="아직 지출 신청이 없습니다" hint="지출 등록으로 첫 신청을 넣어보세요" />
  }

  return (
    <ul className="divide-y divide-line">
      {items.map((item) => (
        <ExpenseRow key={item.id} item={item} />
      ))}
    </ul>
  )
}

function ExpenseRow({ item }: { item: ExpenseItem }) {
  return (
    <li className="px-4 py-3">
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <Badge tone="ok">등록됨</Badge>
        <span className="whitespace-nowrap text-[15px] font-medium">{item.budgetLineName}</span>
        <span className="tabular text-[15px] font-semibold">{formatWon(item.amount)}</span>
        <span className="whitespace-nowrap text-[13.5px] text-ink-soft">{item.spentOn}</span>
        <span className="whitespace-nowrap text-[13.5px] text-ink-soft">{item.requesterName}</span>
      </div>
      <p className="mt-1 text-[15px] text-ink">{item.description}</p>
      <div className="mt-2 flex flex-wrap items-center gap-2">
        {item.receiptPath ? <ReceiptLink path={item.receiptPath} /> : null}
        {item.canDelete ? (
          <form action={deleteExpense}>
            <input type="hidden" name="id" value={item.id} />
            <button
              type="submit"
              className="rounded-lg px-2.5 py-1 text-[13.5px] text-ink-soft underline hover:text-danger"
            >
              등록 취소
            </button>
          </form>
        ) : null}
      </div>
    </li>
  )
}

function ReceiptLink({ path }: { path: string }) {
  const [loading, setLoading] = useState(false)

  async function open() {
    setLoading(true)
    try {
      const url = await getReceiptUrl(path)
      if (url) window.open(url, '_blank', 'noopener,noreferrer')
    } finally {
      setLoading(false)
    }
  }

  return (
    <button
      type="button"
      onClick={open}
      disabled={loading}
      className="rounded-lg bg-canvas px-2.5 py-1 text-[13.5px] font-medium text-ink-soft hover:bg-line disabled:opacity-60"
    >
      {loading ? '여는 중…' : '영수증 보기'}
    </button>
  )
}
