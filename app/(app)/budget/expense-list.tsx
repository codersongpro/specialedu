'use client'

import { useState } from 'react'
import { Badge, EmptyState } from '@/components/ui'
import { formatWon } from '@/lib/format'
import { deleteExpense, getReceiptUrl, reviewExpense } from './actions'

export interface ExpenseItem {
  id: string
  budgetLineName: string
  requesterName: string
  amount: number
  description: string
  spentOn: string
  status: 'pending' | 'approved' | 'rejected'
  receiptPath: string | null
  rejectReason: string | null
  canDelete: boolean
}

const STATUS_LABEL: Record<ExpenseItem['status'], string> = {
  pending: '대기중',
  approved: '승인됨',
  rejected: '반려됨',
}
const STATUS_TONE: Record<ExpenseItem['status'], 'warn' | 'ok' | 'danger'> = {
  pending: 'warn',
  approved: 'ok',
  rejected: 'danger',
}

export function ExpenseList({ items, isAdmin }: { items: ExpenseItem[]; isAdmin: boolean }) {
  if (items.length === 0) {
    return <EmptyState title="아직 지출 신청이 없습니다" hint="지출 등록으로 첫 신청을 넣어보세요" />
  }

  return (
    <ul className="divide-y divide-line">
      {items.map((item) => (
        <ExpenseRow key={item.id} item={item} isAdmin={isAdmin} />
      ))}
    </ul>
  )
}

function ExpenseRow({ item, isAdmin }: { item: ExpenseItem; isAdmin: boolean }) {
  const [rejecting, setRejecting] = useState(false)

  return (
    <li className="px-4 py-3">
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <Badge tone={STATUS_TONE[item.status]}>{STATUS_LABEL[item.status]}</Badge>
        <span className="whitespace-nowrap text-[15px] font-medium">{item.budgetLineName}</span>
        <span className="tabular text-[15px] font-semibold">{formatWon(item.amount)}</span>
        <span className="whitespace-nowrap text-[13.5px] text-ink-soft">{item.spentOn}</span>
        <span className="whitespace-nowrap text-[13.5px] text-ink-soft">{item.requesterName}</span>
      </div>
      <p className="mt-1 text-[15px] text-ink">{item.description}</p>
      {item.status === 'rejected' && item.rejectReason ? (
        <p className="mt-1 text-[13.5px] text-danger">반려 사유: {item.rejectReason}</p>
      ) : null}

      <div className="mt-2 flex flex-wrap items-center gap-2">
        {item.receiptPath ? <ReceiptLink path={item.receiptPath} /> : null}

        {isAdmin && item.status === 'pending' ? (
          <>
            <form action={reviewExpense}>
              <input type="hidden" name="id" value={item.id} />
              <input type="hidden" name="decision" value="approved" />
              <button
                type="submit"
                className="rounded-lg bg-ok-soft px-2.5 py-1 text-[13.5px] font-medium text-ok hover:bg-ok/20"
              >
                승인
              </button>
            </form>

            {rejecting ? (
              <form
                action={reviewExpense}
                className="flex flex-wrap items-center gap-1.5"
                onSubmit={() => setRejecting(false)}
              >
                <input type="hidden" name="id" value={item.id} />
                <input type="hidden" name="decision" value="rejected" />
                <input
                  name="reason"
                  placeholder="반려 사유"
                  maxLength={300}
                  autoFocus
                  className="h-8 rounded-lg border border-line px-2 text-[13.5px] outline-none focus:border-brand"
                />
                <button
                  type="submit"
                  className="rounded-lg bg-danger-soft px-2.5 py-1 text-[13.5px] font-medium text-danger hover:bg-danger/20"
                >
                  반려 확정
                </button>
              </form>
            ) : (
              <button
                type="button"
                onClick={() => setRejecting(true)}
                className="rounded-lg px-2.5 py-1 text-[13.5px] font-medium text-ink-soft hover:bg-canvas"
              >
                반려
              </button>
            )}
          </>
        ) : null}

        {item.canDelete && item.status === 'pending' ? (
          <form action={deleteExpense}>
            <input type="hidden" name="id" value={item.id} />
            <button
              type="submit"
              className="rounded-lg px-2.5 py-1 text-[13.5px] text-ink-soft underline hover:text-danger"
            >
              신청 취소
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
