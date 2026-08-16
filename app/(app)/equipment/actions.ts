'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { createClient, isAdmin, requireSession } from '@/lib/supabase/server'

const itemInput = z.object({
  name: z.string().trim().min(1).max(80),
  category: z.string().trim().max(40).optional(),
  location: z.string().trim().max(80).optional(),
  totalQuantity: z.coerce.number().int().min(1).max(999),
})

const loanInput = z.object({
  itemId: z.string().uuid(),
  quantity: z.coerce.number().int().min(1).max(99),
  dueOn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  note: z.string().trim().max(300).optional(),
})

export type EquipmentState = { error?: string; ok?: boolean }

export async function createEquipmentItem(_prev: EquipmentState, formData: FormData): Promise<EquipmentState> {
  const session = await requireSession()
  if (!isAdmin(session.profile)) return { error: '관리자만 교구를 등록할 수 있습니다' }
  const parsed = itemInput.safeParse({
    name: formData.get('name'), category: formData.get('category') || undefined,
    location: formData.get('location') || undefined, totalQuantity: formData.get('totalQuantity'),
  })
  if (!parsed.success) return { error: '입력을 확인하세요' }

  const { error } = await (await createClient()).from('equipment_items').insert({
    school_id: session.school.id, name: parsed.data.name, category: parsed.data.category || null,
    location: parsed.data.location || null, total_quantity: parsed.data.totalQuantity,
  })
  if (error) return { error: error.code === '23505' ? '같은 이름의 교구가 이미 있습니다' : '저장하지 못했습니다' }
  revalidatePath('/equipment')
  return { ok: true }
}

export async function createEquipmentLoan(_prev: EquipmentState, formData: FormData): Promise<EquipmentState> {
  const session = await requireSession()
  const parsed = loanInput.safeParse({ itemId: formData.get('itemId'), quantity: formData.get('quantity'), dueOn: formData.get('dueOn') || undefined, note: formData.get('note') || undefined })
  if (!parsed.success) return { error: '입력을 확인하세요' }
  const { error } = await (await createClient()).from('equipment_loans').insert({
    school_id: session.school.id, item_id: parsed.data.itemId, borrower_id: session.userId,
    quantity: parsed.data.quantity, due_on: parsed.data.dueOn || null, note: parsed.data.note || null,
  })
  if (error) return { error: '대여할 수 없습니다. 수량과 교구 상태를 확인하세요.' }
  revalidatePath('/equipment')
  return { ok: true }
}

export async function returnEquipmentLoan(formData: FormData): Promise<void> {
  const session = await requireSession()
  const id = z.string().uuid().safeParse(formData.get('id'))
  if (!id.success) return
  const supabase = await createClient()
  const query = supabase.from('equipment_loans').update({ returned_at: new Date().toISOString() }).eq('id', id.data).eq('school_id', session.school.id)
  if (!isAdmin(session.profile)) query.eq('borrower_id', session.userId)
  await query
  revalidatePath('/equipment')
}
