'use client'

import { useMemo, useState, useTransition } from 'react'
import { Badge, Button, Field, inputClass } from '@/components/ui'
import { Modal } from '@/components/modal'
import { cn } from '@/lib/cn'
import { RealtimeRefresh } from '@/components/realtime-refresh'
import { remainingQuantity } from '@/lib/equipment/availability'
import type { EquipmentItemInfo, EquipmentLoanInfo } from '@/lib/data/equipment'
import {
  cancelLoan,
  createLoan,
  deleteEquipmentItem,
  returnLoan,
  saveEquipmentItem,
  toggleEquipmentItemActive,
} from './actions'

function todayIso(): string {
  return new Date().toISOString().slice(0, 10)
}

export function EquipmentPanel({
  schoolId,
  isAdmin,
  myProfileId,
  items,
  loans,
  classes,
}: {
  schoolId: string
  isAdmin: boolean
  myProfileId: string
  items: EquipmentItemInfo[]
  loans: EquipmentLoanInfo[]
  classes: Array<{ id: string; name: string }>
}) {
  const [addItemOpen, setAddItemOpen] = useState(false)
  const [borrowItem, setBorrowItem] = useState<EquipmentItemInfo | null>(null)

  const today = todayIso()
  const loansByItem = useMemo(() => {
    const map = new Map<string, EquipmentLoanInfo[]>()
    for (const loan of loans) {
      const list = map.get(loan.itemId) ?? []
      list.push(loan)
      map.set(loan.itemId, list)
    }
    return map
  }, [loans])

  const activeLoans = loans.filter((l) => l.returnedAt === null)

  return (
    <div className="space-y-6">
      <RealtimeRefresh schoolId={schoolId} tables={['equipment_items', 'equipment_loans']} />

      <div>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-semibold">품목 목록</h2>
          {isAdmin ? <Button onClick={() => setAddItemOpen(true)}>+ 품목 추가</Button> : null}
        </div>

        {items.length === 0 ? null : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {items.map((item) => {
              const left = remainingQuantity(
                { id: item.id, totalQuantity: item.totalQuantity },
                loansByItem.get(item.id) ?? [],
                { startsOn: today, endsOn: today },
              )
              return (
                <ItemCard
                  key={item.id}
                  item={item}
                  remainingToday={left}
                  isAdmin={isAdmin}
                  onBorrow={() => setBorrowItem(item)}
                />
              )
            })}
          </div>
        )}
      </div>

      <div>
        <h2 className="mb-3 text-sm font-semibold">대여 현황 {activeLoans.length}건</h2>
        <div className="rounded-[14px] border border-line bg-surface">
          {loans.length === 0 ? (
            <p className="px-4 py-12 text-center text-sm text-ink-soft">대여 기록이 없습니다</p>
          ) : (
            <ul className="divide-y divide-line">
              {loans.map((loan) => {
                const item = items.find((i) => i.id === loan.itemId)
                const mine = loan.borrowerId === myProfileId
                return (
                  <LoanRow
                    key={loan.id}
                    loan={loan}
                    itemName={item?.name ?? '(삭제된 품목)'}
                    canManage={mine || isAdmin}
                  />
                )
              })}
            </ul>
          )}
        </div>
      </div>

      {addItemOpen ? <AddItemModal onClose={() => setAddItemOpen(false)} /> : null}

      {borrowItem ? (
        <BorrowModal
          item={borrowItem}
          loans={loansByItem.get(borrowItem.id) ?? []}
          classes={classes}
          onClose={() => setBorrowItem(null)}
        />
      ) : null}
    </div>
  )
}

function ItemCard({
  item,
  remainingToday,
  isAdmin,
  onBorrow,
}: {
  item: EquipmentItemInfo
  remainingToday: number
  isAdmin: boolean
  onBorrow: () => void
}) {
  const [pending, startTransition] = useTransition()

  return (
    <div
      className={cn(
        'rounded-[14px] border border-line bg-surface p-4',
        !item.isActive && 'opacity-60',
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="font-medium">{item.name}</p>
          <p className="text-xs text-ink-soft">{item.category}</p>
        </div>
        {!item.isActive ? <Badge tone="neutral">사용 중지</Badge> : null}
      </div>

      <p className="mt-2 text-sm text-ink-soft">
        보유 {item.totalQuantity}대 ·{' '}
        <span className={remainingToday <= 0 ? 'text-danger' : 'text-ok'}>오늘 남음 {remainingToday}대</span>
      </p>
      {item.note ? <p className="mt-1 text-[13px] text-ink-soft">{item.note}</p> : null}

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <Button variant="secondary" onClick={onBorrow} disabled={!item.isActive}>
          빌리기
        </Button>
        {isAdmin ? (
          <>
            <button
              type="button"
              disabled={pending}
              onClick={() =>
                startTransition(() => toggleEquipmentItemActive(item.id, !item.isActive))
              }
              className="text-[13px] text-ink-soft underline hover:text-brand"
            >
              {item.isActive ? '사용 중지' : '다시 사용'}
            </button>
            <button
              type="button"
              disabled={pending}
              onClick={() => startTransition(() => void deleteEquipmentItem(item.id))}
              className="text-[13px] text-ink-soft underline hover:text-danger"
            >
              삭제
            </button>
          </>
        ) : null}
      </div>
    </div>
  )
}

function LoanRow({
  loan,
  itemName,
  canManage,
}: {
  loan: EquipmentLoanInfo
  itemName: string
  canManage: boolean
}) {
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  function onReturn() {
    setError(null)
    startTransition(async () => {
      const result = await returnLoan(loan.id)
      if (result.error) setError(result.error)
    })
  }

  function onCancel() {
    setError(null)
    startTransition(async () => {
      const result = await cancelLoan(loan.id)
      if (result.error) setError(result.error)
    })
  }

  return (
    <li className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-medium">{itemName}</span>
          <span className="text-sm text-ink-soft tabular">{loan.quantity}대</span>
          <span className="text-sm text-ink-soft tabular">
            {loan.startsOn} ~ {loan.endsOn}
          </span>
          {loan.returnedAt ? <Badge tone="ok">반납됨</Badge> : <Badge tone="brand">대여 중</Badge>}
        </div>
        <p className="mt-0.5 text-[13px] text-ink-soft">
          {loan.borrowerName}
          {loan.className ? ` · ${loan.className}` : ''}
          {loan.purpose ? ` · ${loan.purpose}` : ''}
        </p>
        {error ? <p className="mt-0.5 text-[13px] text-danger">{error}</p> : null}
      </div>

      {canManage && !loan.returnedAt ? (
        <div className="flex shrink-0 items-center gap-2">
          <Button variant="secondary" onClick={onReturn} disabled={pending}>
            반납
          </Button>
          <button
            type="button"
            onClick={onCancel}
            disabled={pending}
            className="text-[13px] text-ink-soft underline hover:text-danger"
          >
            취소
          </button>
        </div>
      ) : null}
    </li>
  )
}

function AddItemModal({ onClose }: { onClose: () => void }) {
  const [name, setName] = useState('')
  const [category, setCategory] = useState('')
  const [totalQuantity, setTotalQuantity] = useState(1)
  const [note, setNote] = useState('')
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    startTransition(async () => {
      const result = await saveEquipmentItem(null, { name, category, totalQuantity, note })
      if (result.error) setError(result.error)
      else onClose()
    })
  }

  return (
    <Modal open onClose={onClose} title="품목 추가">
      <form onSubmit={onSubmit} className="space-y-3">
        <Field label="이름" htmlFor="equip-name">
          <input
            id="equip-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className={inputClass}
            placeholder="예: 태블릿"
            required
          />
        </Field>
        <Field label="분류 (선택)" htmlFor="equip-category">
          <input
            id="equip-category"
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            className={inputClass}
            placeholder="예: 보조공학기기"
          />
        </Field>
        <Field label="보유 수량" htmlFor="equip-quantity">
          <input
            id="equip-quantity"
            type="number"
            min={1}
            value={totalQuantity}
            onChange={(e) => setTotalQuantity(Number(e.target.value))}
            className={inputClass}
          />
        </Field>
        <Field label="메모 (선택)" htmlFor="equip-note">
          <input
            id="equip-note"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            maxLength={200}
            className={inputClass}
          />
        </Field>

        {error ? <p className="text-sm text-danger">{error}</p> : null}

        <Button type="submit" disabled={pending} className="w-full">
          {pending ? '저장 중' : '추가'}
        </Button>
      </form>
    </Modal>
  )
}

function BorrowModal({
  item,
  loans,
  classes,
  onClose,
}: {
  item: EquipmentItemInfo
  loans: EquipmentLoanInfo[]
  classes: Array<{ id: string; name: string }>
  onClose: () => void
}) {
  const today = todayIso()
  const [startsOn, setStartsOn] = useState(today)
  const [endsOn, setEndsOn] = useState(today)
  const [quantity, setQuantity] = useState(1)
  const [classId, setClassId] = useState('')
  const [purpose, setPurpose] = useState('')
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  const left = remainingQuantity(
    { id: item.id, totalQuantity: item.totalQuantity },
    loans,
    { startsOn, endsOn: endsOn < startsOn ? startsOn : endsOn },
  )

  function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    startTransition(async () => {
      const result = await createLoan({
        itemId: item.id,
        quantity,
        classId: classId || undefined,
        startsOn,
        endsOn,
        purpose: purpose || undefined,
      })
      if (result.error) setError(result.error)
      else onClose()
    })
  }

  return (
    <Modal open onClose={onClose} title={`빌리기 — ${item.name}`}>
      <form onSubmit={onSubmit} className="space-y-3">
        <div className="grid grid-cols-2 gap-2">
          <Field label="대여일" htmlFor="loan-starts">
            <input
              id="loan-starts"
              type="date"
              value={startsOn}
              min={today}
              onChange={(e) => setStartsOn(e.target.value)}
              className={inputClass}
            />
          </Field>
          <Field label="반납일" htmlFor="loan-ends">
            <input
              id="loan-ends"
              type="date"
              value={endsOn}
              min={startsOn}
              onChange={(e) => setEndsOn(e.target.value)}
              className={inputClass}
            />
          </Field>
        </div>

        <Field label="수량" htmlFor="loan-quantity">
          <input
            id="loan-quantity"
            type="number"
            min={1}
            value={quantity}
            onChange={(e) => setQuantity(Number(e.target.value))}
            className={inputClass}
          />
        </Field>

        <p className={cn('text-[13px]', left - quantity < 0 ? 'text-danger' : 'text-ink-soft')}>
          이 기간에 남은 수량: {left}대
        </p>

        <Field label="학급 (선택)" htmlFor="loan-class">
          <select id="loan-class" value={classId} onChange={(e) => setClassId(e.target.value)} className={inputClass}>
            <option value="">선택 안 함</option>
            {classes.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </Field>

        <Field label="용도 (선택)" htmlFor="loan-purpose">
          <input
            id="loan-purpose"
            value={purpose}
            onChange={(e) => setPurpose(e.target.value)}
            maxLength={200}
            className={inputClass}
            placeholder="예: 감각통합수업"
          />
        </Field>

        {error ? <p className="text-sm text-danger">{error}</p> : null}

        <Button type="submit" disabled={pending} className="w-full">
          {pending ? '처리 중' : '빌리기'}
        </Button>
      </form>
    </Modal>
  )
}
