'use client'

import { useActionState, useEffect, useState } from 'react'
import { Button, Field, inputClass } from '@/components/ui'
import { createBudgetLine, type BudgetLineState } from './actions'

export function BudgetLineFormModal({
  departments,
  classes,
}: {
  departments: Array<{ id: string; name: string }>
  classes: Array<{ id: string; name: string }>
}) {
  const [open, setOpen] = useState(false)
  const [state, formAction, pending] = useActionState<BudgetLineState, FormData>(
    createBudgetLine,
    {},
  )
  const [scope, setScope] = useState<'department' | 'class'>('department')

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
    const timer = setTimeout(() => setOpen(false), 700)
    return () => clearTimeout(timer)
  }, [state.ok])

  return (
    <>
      <Button variant="secondary" onClick={() => setOpen(true)}>
        예산 항목 추가
      </Button>

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
              <h2 className="text-base font-semibold">예산 항목 추가</h2>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="-mr-2 -mt-1 rounded-lg px-2 py-1 text-[15px] text-ink-soft hover:bg-canvas"
              >
                닫기
              </button>
            </div>

            <form action={formAction} className="space-y-3">
              <Field label="배정 대상" htmlFor="scope">
                <select
                  id="scope"
                  name="scope"
                  value={scope}
                  onChange={(e) => setScope(e.target.value as 'department' | 'class')}
                  className={inputClass}
                >
                  <option value="department">부서</option>
                  <option value="class">학급</option>
                </select>
              </Field>

              {scope === 'department' ? (
                <Field label="부서" htmlFor="departmentId">
                  <select id="departmentId" name="departmentId" required className={inputClass}>
                    {departments.map((d) => (
                      <option key={d.id} value={d.id}>
                        {d.name}
                      </option>
                    ))}
                  </select>
                </Field>
              ) : (
                <Field label="학급" htmlFor="classId">
                  <select id="classId" name="classId" required className={inputClass}>
                    {classes.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </Field>
              )}

              <Field label="항목 이름" htmlFor="name" hint="예: 현장체험학습비, 교구 구입비">
                <input id="name" name="name" required maxLength={80} className={inputClass} />
              </Field>

              <Field label="배정액(원)" htmlFor="allocatedAmount">
                <input
                  id="allocatedAmount"
                  name="allocatedAmount"
                  type="number"
                  required
                  min={0}
                  step={1000}
                  className={inputClass}
                />
              </Field>

              <Field label="메모" htmlFor="note" hint="선택 사항">
                <input id="note" name="note" maxLength={300} className={inputClass} />
              </Field>

              {state.error ? (
                <p role="alert" className="rounded-lg bg-danger-soft px-3 py-2 text-sm text-danger">
                  {state.error}
                </p>
              ) : null}
              {state.ok ? (
                <p className="rounded-lg bg-ok-soft px-3 py-2 text-sm text-ok">만들었습니다</p>
              ) : null}

              <Button type="submit" disabled={pending} className="w-full">
                {pending ? '저장 중' : '만들기'}
              </Button>
            </form>
          </div>
        </div>
      ) : null}
    </>
  )
}
