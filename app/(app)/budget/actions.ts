'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { AUDIT_ACTIONS, writeAudit } from '@/lib/security/audit'
import { createClient, isAdmin, requireSession } from '@/lib/supabase/server'

const RECEIPT_MAX_BYTES = 8 * 1024 * 1024

const BudgetLineInput = z.object({
  scope: z.enum(['department', 'class']),
  departmentId: z.string().uuid().nullable(),
  classId: z.string().uuid().nullable(),
  name: z.string().min(1, '항목 이름을 적어 주세요').max(80),
  allocatedAmount: z.coerce.number().int().min(0).max(1_000_000_000),
  note: z.string().max(300).optional(),
})

export interface BudgetLineState {
  error?: string
  ok?: boolean
}

/** 예산 항목(배정) 만들기 — 관리자·부장만. RLS 에서도 같은 규칙이 걸려 있다. */
export async function createBudgetLine(
  _prev: BudgetLineState,
  formData: FormData,
): Promise<BudgetLineState> {
  const session = await requireSession()
  if (!isAdmin(session.profile)) return { error: '관리자만 예산 항목을 만들 수 있습니다' }

  const scope = formData.get('scope')
  const parsed = BudgetLineInput.safeParse({
    scope,
    departmentId: scope === 'department' ? formData.get('departmentId') || null : null,
    classId: scope === 'class' ? formData.get('classId') || null : null,
    name: formData.get('name'),
    allocatedAmount: formData.get('allocatedAmount'),
    note: formData.get('note') || undefined,
  })

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? '입력을 확인하세요' }
  }
  const input = parsed.data

  if (input.scope === 'department' && !input.departmentId) return { error: '부서를 골라 주세요' }
  if (input.scope === 'class' && !input.classId) return { error: '학급을 골라 주세요' }

  const supabase = await createClient()
  const { error } = await supabase.from('budget_lines').insert({
    school_id: session.school.id,
    fiscal_year: new Date().getFullYear(),
    scope: input.scope,
    department_id: input.departmentId,
    class_id: input.classId,
    name: input.name,
    allocated_amount: input.allocatedAmount,
    note: input.note ?? null,
    created_by: session.userId,
  })

  if (error) return { error: '만들지 못했습니다. 잠시 후 다시 시도해 주세요.' }

  await writeAudit({
    schoolId: session.school.id,
    actorId: session.userId,
    actorName: session.profile.name,
    action: AUDIT_ACTIONS.budgetLineCreate,
    targetTable: 'budget_lines',
    meta: { scope: input.scope, allocatedAmount: input.allocatedAmount },
  })

  revalidatePath('/budget')
  return { ok: true }
}

const ExpenseInput = z.object({
  budgetLineId: z.string().uuid('예산 항목을 골라 주세요'),
  amount: z.coerce.number().int().min(1, '금액을 입력해 주세요').max(1_000_000_000),
  description: z.string().min(1, '사용 내역을 적어 주세요').max(300),
  spentOn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
})

export interface ExpenseState {
  error?: string
  ok?: boolean
}

/**
 * 지출 신청(품의). 누구나 넣을 수 있고, 대기중(pending) 상태로 들어간다 —
 * 관리자가 승인해야 배정액에서 실제로 빠진다. 영수증은 선택 첨부다.
 */
export async function createExpense(
  _prev: ExpenseState,
  formData: FormData,
): Promise<ExpenseState> {
  const session = await requireSession()

  const parsed = ExpenseInput.safeParse({
    budgetLineId: formData.get('budgetLineId'),
    amount: formData.get('amount'),
    description: formData.get('description'),
    spentOn: formData.get('spentOn'),
  })

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? '입력을 확인하세요' }
  }
  const input = parsed.data

  const receipt = formData.get('receipt')
  const hasReceipt = receipt instanceof File && receipt.size > 0
  if (hasReceipt && receipt.size > RECEIPT_MAX_BYTES) {
    return { error: '영수증 파일은 8MB 이하로 올려 주세요' }
  }

  const supabase = await createClient()
  const { data: created, error } = await supabase
    .from('budget_expenses')
    .insert({
      school_id: session.school.id,
      budget_line_id: input.budgetLineId,
      requested_by: session.userId,
      amount: input.amount,
      description: input.description,
      spent_on: input.spentOn,
    })
    .select('id')
    .single()

  if (error || !created) return { error: '신청하지 못했습니다. 예산 항목을 다시 확인해 주세요.' }

  if (hasReceipt && receipt instanceof File) {
    const path = `${session.school.id}/${created.id}/${sanitizeFileName(receipt.name)}`
    const { error: uploadError } = await supabase.storage.from('receipts').upload(path, receipt, {
      contentType: receipt.type || undefined,
    })
    if (!uploadError) {
      await supabase.from('budget_expenses').update({ receipt_path: path }).eq('id', created.id)
    }
    // 영수증 업로드가 실패해도 지출 신청 자체는 이미 됐다 — 신청을 무르지 않는다.
    // 영수증은 나중에 다시 첨부하도록 안내한다.
  }

  await writeAudit({
    schoolId: session.school.id,
    actorId: session.userId,
    actorName: session.profile.name,
    action: AUDIT_ACTIONS.budgetExpenseCreate,
    targetTable: 'budget_expenses',
    targetId: created.id,
    meta: { amount: input.amount },
  })

  revalidatePath('/budget')
  return { ok: true }
}

/** 지출 승인·반려 — 관리자·부장만. */
export async function reviewExpense(formData: FormData): Promise<void> {
  const session = await requireSession()
  if (!isAdmin(session.profile)) return

  const id = String(formData.get('id') ?? '')
  const decision = String(formData.get('decision') ?? '')
  if (!id || (decision !== 'approved' && decision !== 'rejected')) return
  const reason = decision === 'rejected' ? String(formData.get('reason') ?? '').slice(0, 300) : null

  const supabase = await createClient()
  await supabase
    .from('budget_expenses')
    .update({
      status: decision,
      reviewed_by: session.userId,
      reviewed_at: new Date().toISOString(),
      reject_reason: reason,
    })
    .eq('id', id)

  await writeAudit({
    schoolId: session.school.id,
    actorId: session.userId,
    actorName: session.profile.name,
    action: decision === 'approved' ? AUDIT_ACTIONS.budgetExpenseApprove : AUDIT_ACTIONS.budgetExpenseReject,
    targetTable: 'budget_expenses',
    targetId: id,
  })

  revalidatePath('/budget')
}

/** 신청 취소 — 신청 본인이 대기중일 때만(RLS 가 최종 확인). */
export async function deleteExpense(formData: FormData): Promise<void> {
  await requireSession()
  const id = String(formData.get('id') ?? '')
  if (!id) return

  const supabase = await createClient()
  await supabase.from('budget_expenses').delete().eq('id', id)
  revalidatePath('/budget')
}

/** 영수증 서명 URL. 60초만 유효 — 매번 눌렀을 때 새로 발급한다. */
export async function getReceiptUrl(path: string): Promise<string | null> {
  await requireSession()
  const supabase = await createClient()
  const { data } = await supabase.storage.from('receipts').createSignedUrl(path, 60)
  return data?.signedUrl ?? null
}

function sanitizeFileName(name: string): string {
  const cleaned = name.replace(/[^a-zA-Z0-9._-]/g, '_').slice(-80)
  return cleaned || 'receipt'
}
