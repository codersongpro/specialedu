'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { AUDIT_ACTIONS, writeAudit } from '@/lib/security/audit'
import { createClient, isAdmin, requireSession } from '@/lib/supabase/server'

const PATH = '/equipment'

export interface SimpleResult {
  ok?: boolean
  error?: string
}

const ItemInput = z.object({
  name: z.string().min(1, '이름을 적어 주세요').max(60),
  category: z.string().max(30).optional(),
  totalQuantity: z.coerce.number().int().min(1, '수량은 1 이상이어야 합니다'),
  note: z.string().max(200).optional(),
})

/** 품목 등록·수정 — 관리자만. */
export async function saveEquipmentItem(
  id: string | null,
  input: z.input<typeof ItemInput>,
): Promise<SimpleResult> {
  const session = await requireSession()
  if (!isAdmin(session.profile)) return { error: '관리자만 할 수 있습니다' }

  const parsed = ItemInput.safeParse(input)
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? '입력을 확인하세요' }

  const supabase = await createClient()
  const row = {
    school_id: session.school.id,
    name: parsed.data.name,
    category: parsed.data.category || 'general',
    total_quantity: parsed.data.totalQuantity,
    note: parsed.data.note || null,
  }
  const { data, error } = id
    ? await supabase.from('equipment_items').update(row).eq('id', id).select('id').single()
    : await supabase.from('equipment_items').insert(row).select('id').single()

  if (error || !data) {
    return { error: error?.code === '23505' ? '이미 있는 이름입니다' : '저장하지 못했습니다' }
  }

  await writeAudit({
    schoolId: session.school.id,
    actorId: session.userId,
    actorName: session.profile.name,
    action: AUDIT_ACTIONS.equipmentItemSave,
    targetTable: 'equipment_items',
    targetId: data.id,
  })

  revalidatePath(PATH)
  return { ok: true }
}

/** 품목 사용 중지/다시 사용 — 관리자만. */
export async function toggleEquipmentItemActive(id: string, isActive: boolean): Promise<void> {
  const session = await requireSession()
  if (!isAdmin(session.profile)) return
  if (!z.string().uuid().safeParse(id).success) return

  const supabase = await createClient()
  await supabase.from('equipment_items').update({ is_active: isActive }).eq('id', id)
  revalidatePath(PATH)
}

/** 품목 삭제 — 관리자만. 대여 기록이 남아 있으면 FK 제약으로 거부된다. */
export async function deleteEquipmentItem(id: string): Promise<SimpleResult> {
  const session = await requireSession()
  if (!isAdmin(session.profile)) return { error: '관리자만 할 수 있습니다' }
  if (!z.string().uuid().safeParse(id).success) return { error: '잘못된 요청입니다' }

  const supabase = await createClient()
  const { error } = await supabase.from('equipment_items').delete().eq('id', id)
  if (error) {
    return { error: '지우지 못했습니다. 이 품목의 대여 기록이 남아 있으면 대신 "사용 중지"를 쓰세요.' }
  }

  await writeAudit({
    schoolId: session.school.id,
    actorId: session.userId,
    actorName: session.profile.name,
    action: AUDIT_ACTIONS.equipmentItemDelete,
    targetTable: 'equipment_items',
    targetId: id,
  })

  revalidatePath(PATH)
  return { ok: true }
}

const LoanInput = z.object({
  itemId: z.string().uuid(),
  quantity: z.coerce.number().int().min(1, '수량은 1 이상이어야 합니다'),
  classId: z.string().uuid().optional(),
  startsOn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, '날짜 형식이 올바르지 않습니다'),
  endsOn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, '날짜 형식이 올바르지 않습니다'),
  purpose: z.string().max(200).optional(),
})

/**
 * 대여 등록 — 누구나 자기 이름으로 등록. 재고 초과 여부는 DB 트리거
 * (`check_equipment_capacity()`)가 최종 판단한다 — 화면의 남은 수량
 * 표시는 미리 보여주는 힌트일 뿐이라 여기서 다시 세지 않는다.
 */
export async function createLoan(input: z.input<typeof LoanInput>): Promise<SimpleResult> {
  const session = await requireSession()
  const parsed = LoanInput.safeParse(input)
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? '입력을 확인하세요' }
  if (parsed.data.endsOn < parsed.data.startsOn) {
    return { error: '반납일이 대여일보다 빨라야 합니다' }
  }

  const supabase = await createClient()
  const { data, error } = await supabase
    .from('equipment_loans')
    .insert({
      school_id: session.school.id,
      item_id: parsed.data.itemId,
      quantity: parsed.data.quantity,
      borrower_id: session.userId,
      class_id: parsed.data.classId || null,
      starts_on: parsed.data.startsOn,
      ends_on: parsed.data.endsOn,
      purpose: parsed.data.purpose || null,
    })
    .select('id')
    .single()

  if (error || !data) {
    return { error: error?.code === '23514' ? '그 기간에 남은 수량이 없습니다' : '대여하지 못했습니다' }
  }

  await writeAudit({
    schoolId: session.school.id,
    actorId: session.userId,
    actorName: session.profile.name,
    action: AUDIT_ACTIONS.equipmentLoanCreate,
    targetTable: 'equipment_loans',
    targetId: data.id,
  })

  revalidatePath(PATH)
  return { ok: true }
}

/** 반납 처리 — 본인 또는 관리자만(RLS가 최종 확인). */
export async function returnLoan(id: string): Promise<SimpleResult> {
  const session = await requireSession()
  if (!z.string().uuid().safeParse(id).success) return { error: '잘못된 요청입니다' }

  const supabase = await createClient()
  const { error } = await supabase
    .from('equipment_loans')
    .update({ returned_at: new Date().toISOString() })
    .eq('id', id)
  if (error) return { error: '반납 처리하지 못했습니다' }

  await writeAudit({
    schoolId: session.school.id,
    actorId: session.userId,
    actorName: session.profile.name,
    action: AUDIT_ACTIONS.equipmentLoanReturn,
    targetTable: 'equipment_loans',
    targetId: id,
  })

  revalidatePath(PATH)
  return { ok: true }
}

/** 대여 취소(잘못 등록한 경우) — 본인 또는 관리자만. */
export async function cancelLoan(id: string): Promise<SimpleResult> {
  const session = await requireSession()
  if (!z.string().uuid().safeParse(id).success) return { error: '잘못된 요청입니다' }

  const supabase = await createClient()
  const { error } = await supabase.from('equipment_loans').delete().eq('id', id)
  if (error) return { error: '취소하지 못했습니다' }

  await writeAudit({
    schoolId: session.school.id,
    actorId: session.userId,
    actorName: session.profile.name,
    action: AUDIT_ACTIONS.equipmentLoanCancel,
    targetTable: 'equipment_loans',
    targetId: id,
  })

  revalidatePath(PATH)
  return { ok: true }
}
