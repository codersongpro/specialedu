import type { EquipmentLoan } from '@/lib/equipment/availability'
import type { TypedClient } from '@/lib/supabase/server'

/**
 * 교구 대여 화면에 필요한 것을 한 번에 읽어 온다.
 *
 * lib/data/staffing.ts와 같은 모양이다 — 화면(page.tsx)이 items·loans를
 * lib/equipment/availability.ts의 remainingQuantity()에 그대로 넘긴다.
 */
export interface EquipmentItemInfo {
  id: string
  name: string
  category: string
  totalQuantity: number
  note: string | null
  isActive: boolean
}

export interface EquipmentLoanInfo extends EquipmentLoan {
  borrowerId: string
  borrowerName: string
  classId: string | null
  className: string | null
  purpose: string | null
}

export interface EquipmentContext {
  items: EquipmentItemInfo[]
  loans: EquipmentLoanInfo[]
  classes: Array<{ id: string; name: string }>
}

export async function loadEquipmentContext(
  supabase: TypedClient,
  schoolId: string,
): Promise<EquipmentContext> {
  const [itemsRes, loansRes, profilesRes, classesRes] = await Promise.all([
    supabase
      .from('equipment_items')
      .select('id, name, category, total_quantity, note, is_active')
      .eq('school_id', schoolId)
      .order('name'),
    supabase
      .from('equipment_loans')
      .select('id, item_id, quantity, borrower_id, class_id, starts_on, ends_on, purpose, returned_at')
      .eq('school_id', schoolId)
      .order('starts_on', { ascending: false }),
    supabase.from('profiles').select('id, name').eq('school_id', schoolId),
    supabase.from('classes').select('id, name').eq('school_id', schoolId).order('name'),
  ])

  const profileById = new Map((profilesRes.data ?? []).map((p) => [p.id, p.name]))
  const classById = new Map((classesRes.data ?? []).map((c) => [c.id, c.name]))

  const items: EquipmentItemInfo[] = (itemsRes.data ?? []).map((row) => ({
    id: row.id,
    name: row.name,
    category: row.category,
    totalQuantity: row.total_quantity,
    note: row.note,
    isActive: row.is_active,
  }))

  const loans: EquipmentLoanInfo[] = (loansRes.data ?? []).map((row) => ({
    id: row.id,
    itemId: row.item_id,
    quantity: row.quantity,
    startsOn: row.starts_on,
    endsOn: row.ends_on,
    returnedAt: row.returned_at,
    borrowerId: row.borrower_id,
    borrowerName: profileById.get(row.borrower_id) ?? '(알 수 없음)',
    classId: row.class_id,
    className: row.class_id ? (classById.get(row.class_id) ?? null) : null,
    purpose: row.purpose,
  }))

  return {
    items,
    loans,
    classes: (classesRes.data ?? []).map((c) => ({ id: c.id, name: c.name })),
  }
}
