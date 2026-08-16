'use client'

import { useActionState, useEffect, useState } from 'react'
import { Button, Field, inputClass } from '@/components/ui'
import { todayString } from '@/lib/date'
import { createExpense, scanReceipt, type ExpenseState } from './actions'

export function ExpenseFormModal({
  budgetLines,
}: {
  budgetLines: Array<{ id: string; label: string }>
}) {
  const [open, setOpen] = useState(false)
  const [state, formAction, pending] = useActionState<ExpenseState, FormData>(createExpense, {})

  const [scanning, setScanning] = useState(false)
  const [scanError, setScanError] = useState<string | null>(null)
  const [receiptPath, setReceiptPath] = useState('')
  const [receiptName, setReceiptName] = useState('')
  const [amount, setAmount] = useState('')
  const [spentOn, setSpentOn] = useState(todayString())
  const [description, setDescription] = useState('')

  useEffect(() => {
    if (!open) return
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') setOpen(false)
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [open])

  useEffect(() => {
    if (!state.ok) return
    const timer = setTimeout(() => setOpen(false), 900)
    return () => clearTimeout(timer)
  }, [state.ok])

  async function onPickReceipt(file: File | undefined) {
    if (!file) return
    setReceiptName(file.name)
    setScanning(true)
    setScanError(null)
    try {
      const result = await scanReceipt(file)
      if (result.path) setReceiptPath(result.path)
      if (result.error) setScanError(result.error)
      if (result.amount) setAmount(String(result.amount))
      if (result.date) setSpentOn(result.date)
      if (result.vendor) setDescription(result.vendor)
    } finally {
      setScanning(false)
    }
  }

  if (budgetLines.length === 0) {
    return (
      <Button disabled title="먼저 예산 항목을 만들어야 합니다">
        지출 등록
      </Button>
    )
  }

  return (
    <>
      <Button onClick={() => setOpen(true)}>지출 등록</Button>

      {open ? (
        <div
          className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-ink/40 px-4 py-8 sm:items-center"
          onClick={() => setOpen(false)}
        >
          <div
            className="w-full max-w-sm rounded-[14px] border border-line bg-surface p-4 shadow-xl"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-base font-semibold">지출 등록</h2>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="-mr-2 -mt-1 rounded-lg px-2 py-1 text-[15px] text-ink-soft hover:bg-canvas"
              >
                닫기
              </button>
            </div>

            <form action={formAction} className="space-y-3">
              <input type="hidden" name="receiptPath" value={receiptPath} />

              <Field label="영수증 사진" htmlFor="receipt" hint="사진을 고르면 금액·날짜를 자동으로 채웁니다">
                <input
                  id="receipt"
                  type="file"
                  accept="image/*,application/pdf"
                  onChange={(e) => onPickReceipt(e.target.files?.[0])}
                  className="block w-full text-[15px] file:mr-3 file:h-9 file:rounded-lg file:border-0 file:bg-canvas file:px-3 file:text-[14px] file:font-medium"
                />
                {scanning ? (
                  <p className="mt-1.5 text-[13px] text-ink-soft">
                    {receiptName} 올리는 중 · AI로 금액·날짜 읽는 중…
                  </p>
                ) : receiptPath ? (
                  <p className="mt-1.5 text-[13px] text-ok">{receiptName} 첨부됨</p>
                ) : null}
                {scanError ? <p className="mt-1.5 text-[13px] text-warn">{scanError}</p> : null}
              </Field>

              <p className="rounded-lg bg-canvas px-3 py-2 text-[13px] leading-relaxed text-ink-soft">
                사진은 금액·날짜·상호명을 읽기 위해 Gemini AI로 전송됩니다. 영수증에 학생·개인
                이름이 나오지 않게 주의하세요.
              </p>

              <Field label="예산 항목" htmlFor="budgetLineId">
                <select id="budgetLineId" name="budgetLineId" required className={inputClass}>
                  {budgetLines.map((line) => (
                    <option key={line.id} value={line.id}>
                      {line.label}
                    </option>
                  ))}
                </select>
              </Field>

              <Field label="금액(원)" htmlFor="amount">
                <input
                  id="amount"
                  name="amount"
                  type="number"
                  required
                  min={1}
                  step={100}
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  className={inputClass}
                />
              </Field>

              <Field label="사용일" htmlFor="spentOn">
                <input
                  id="spentOn"
                  name="spentOn"
                  type="date"
                  required
                  value={spentOn}
                  onChange={(e) => setSpentOn(e.target.value)}
                  className={inputClass}
                />
              </Field>

              <Field label="사용 내역" htmlFor="description" hint="무엇에 썼는지 짧게 — 자동으로 채워지면 확인만">
                <input
                  id="description"
                  name="description"
                  required
                  maxLength={300}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className={inputClass}
                />
              </Field>

              <p className="text-[13px] text-ink-soft">
                등록하면 예산 집행액과 잔액에 바로 반영됩니다.
              </p>

              {state.error ? (
                <p role="alert" className="rounded-lg bg-danger-soft px-3 py-2 text-sm text-danger">
                  {state.error}
                </p>
              ) : null}
              {state.ok ? (
                <p className="rounded-lg bg-ok-soft px-3 py-2 text-sm text-ok">등록했습니다</p>
              ) : null}

              <Button type="submit" disabled={pending || scanning} className="w-full">
                {pending ? '저장 중' : '등록'}
              </Button>
            </form>
          </div>
        </div>
      ) : null}
    </>
  )
}
