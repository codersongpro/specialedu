'use client'

import { useActionState, useEffect, useState } from 'react'
import { Button, Field, inputClass } from '@/components/ui'
import { todayString } from '@/lib/date'
import { createExpense, type ExpenseState } from './actions'

export function ExpenseFormModal({
  budgetLines,
}: {
  budgetLines: Array<{ id: string; label: string }>
}) {
  const [open, setOpen] = useState(false)
  const [state, formAction, pending] = useActionState<ExpenseState, FormData>(createExpense, {})

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
                  className={inputClass}
                />
              </Field>

              <Field label="사용일" htmlFor="spentOn">
                <input
                  id="spentOn"
                  name="spentOn"
                  type="date"
                  required
                  defaultValue={todayString()}
                  className={inputClass}
                />
              </Field>

              <Field label="사용 내역" htmlFor="description" hint="무엇에 썼는지 짧게">
                <input id="description" name="description" required maxLength={300} className={inputClass} />
              </Field>

              <Field label="영수증" htmlFor="receipt" hint="사진 또는 PDF, 선택 사항">
                <input
                  id="receipt"
                  name="receipt"
                  type="file"
                  accept="image/*,application/pdf"
                  className="block w-full text-[15px] file:mr-3 file:h-9 file:rounded-lg file:border-0 file:bg-canvas file:px-3 file:text-[14px] file:font-medium"
                />
              </Field>

              <p className="text-[13px] text-ink-soft">
                신청하면 대기 상태로 들어가고, 관리자가 승인해야 예산에서 실제로 빠집니다.
              </p>

              {state.error ? (
                <p role="alert" className="rounded-lg bg-danger-soft px-3 py-2 text-sm text-danger">
                  {state.error}
                </p>
              ) : null}
              {state.ok ? (
                <p className="rounded-lg bg-ok-soft px-3 py-2 text-sm text-ok">신청했습니다</p>
              ) : null}

              <Button type="submit" disabled={pending} className="w-full">
                {pending ? '저장 중' : '신청'}
              </Button>
            </form>
          </div>
        </div>
      ) : null}
    </>
  )
}
