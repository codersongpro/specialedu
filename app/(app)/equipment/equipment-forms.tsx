'use client'

import { useActionState, useEffect, useState } from 'react'
import { Button, Field, inputClass } from '@/components/ui'
import { createEquipmentItem, createEquipmentLoan, type EquipmentState } from './actions'

function Modal({ title, children }: { title: string; children: React.ReactNode }) {
  return <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/40 px-4"><div className="w-full max-w-sm rounded-[14px] border border-line bg-surface p-4 shadow-xl"><h2 className="mb-3 text-base font-semibold">{title}</h2>{children}</div></div>
}

export function EquipmentItemForm() {
  const [open, setOpen] = useState(false)
  const [state, action, pending] = useActionState<EquipmentState, FormData>(createEquipmentItem, {})
  useEffect(() => { if (state.ok) setOpen(false) }, [state.ok])
  return <>{<Button onClick={() => setOpen(true)}>교구 등록</Button>}{open ? <Modal title="교구 등록"><form action={action} className="space-y-3"><Field label="교구 이름"><input name="name" required maxLength={80} className={inputClass} /></Field><Field label="수량"><input name="totalQuantity" type="number" required min={1} defaultValue={1} className={inputClass} /></Field><Field label="분류"><input name="category" maxLength={40} className={inputClass} /></Field><Field label="보관 위치"><input name="location" maxLength={80} className={inputClass} /></Field>{state.error ? <p className="text-sm text-danger">{state.error}</p> : null}<div className="flex gap-2"><Button type="submit" disabled={pending}>저장</Button><Button type="button" variant="secondary" onClick={() => setOpen(false)}>취소</Button></div></form></Modal> : null}</>
}

export function EquipmentLoanForm({ items }: { items: Array<{ id: string; name: string; available: number }> }) {
  const [open, setOpen] = useState(false)
  const [state, action, pending] = useActionState<EquipmentState, FormData>(createEquipmentLoan, {})
  useEffect(() => { if (state.ok) setOpen(false) }, [state.ok])
  if (!items.length) return <Button disabled>대여 등록</Button>
  return <>{<Button onClick={() => setOpen(true)}>대여 등록</Button>}{open ? <Modal title="교구 대여"><form action={action} className="space-y-3"><Field label="교구"><select name="itemId" className={inputClass}>{items.map((item) => <option key={item.id} value={item.id}>{item.name} · {item.available}개 가능</option>)}</select></Field><Field label="대여 수량"><input name="quantity" type="number" required min={1} defaultValue={1} className={inputClass} /></Field><Field label="반납 예정일"><input name="dueOn" type="date" className={inputClass} /></Field><Field label="메모"><input name="note" maxLength={300} className={inputClass} /></Field>{state.error ? <p className="text-sm text-danger">{state.error}</p> : null}<div className="flex gap-2"><Button type="submit" disabled={pending}>대여</Button><Button type="button" variant="secondary" onClick={() => setOpen(false)}>취소</Button></div></form></Modal> : null}</>
}
