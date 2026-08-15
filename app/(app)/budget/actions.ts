'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { extractReceiptFields } from '@/lib/ai/gemini'
import { AUDIT_ACTIONS, writeAudit } from '@/lib/security/audit'
import { decryptSecret } from '@/lib/security/crypto'
import { createAdminClient } from '@/lib/supabase/admin'
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
  receiptPath: z.string().max(300).optional(),
})

export interface ExpenseState {
  error?: string
  ok?: boolean
}

/**
 * 지출 신청(품의). 누구나 넣을 수 있고, 대기중(pending) 상태로 들어간다 —
 * 관리자가 승인해야 배정액에서 실제로 빠진다.
 *
 * 영수증은 여기서 올리지 않는다. scanReceipt()가 사진을 고르는 순간 이미
 * 올려서 금액·날짜를 자동으로 채워 두고, 여기서는 그 경로만 넘겨받아
 * 그대로 저장한다.
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
    receiptPath: formData.get('receiptPath') || undefined,
  })

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? '입력을 확인하세요' }
  }
  const input = parsed.data

  // scanReceipt()가 올린 경로가 아니면(다른 학교 경로를 조작해 넣는 등) 무시한다
  const receiptPath =
    input.receiptPath && input.receiptPath.startsWith(`${session.school.id}/`) ? input.receiptPath : null

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
      receipt_path: receiptPath,
    })
    .select('id')
    .single()

  if (error || !created) return { error: '신청하지 못했습니다. 예산 항목을 다시 확인해 주세요.' }

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

export interface ReceiptScanResult {
  path?: string
  amount?: number | null
  date?: string | null
  vendor?: string | null
  error?: string
}

/**
 * 영수증 사진을 고르면 바로 호출된다 — 업로드와 Gemini Vision 인식을
 * 한 번에 한다. 개인 Gemini 키가 등록돼 있으면 그걸 우선 쓰고, 없으면
 * 학교 공용 키를 쓴다. 둘 다 없으면 업로드까지만 하고 직접 입력하라고
 * 알려준다 — 사진 자체는 이미 신청서에 붙게 된다.
 */
export async function scanReceipt(file: File): Promise<ReceiptScanResult> {
  const session = await requireSession()

  if (!(file instanceof File) || file.size === 0) return { error: '파일이 없습니다' }
  if (file.size > RECEIPT_MAX_BYTES) return { error: '영수증 파일은 8MB 이하로 올려 주세요' }

  const supabase = await createClient()
  const path = `${session.school.id}/${crypto.randomUUID()}/${sanitizeFileName(file.name)}`
  const { error: uploadError } = await supabase.storage.from('receipts').upload(path, file, {
    contentType: file.type || undefined,
  })
  if (uploadError) return { error: '업로드하지 못했습니다' }

  const keySource: 'personal' | 'school' | null = session.profile.gemini_key_enc
    ? 'personal'
    : session.school.gemini_key_enc
      ? 'school'
      : null
  const encryptedKey = session.profile.gemini_key_enc ?? session.school.gemini_key_enc

  if (!encryptedKey || !keySource) {
    return { path, error: '등록된 Gemini 키가 없어 자동 인식을 쓸 수 없습니다. 직접 입력해 주세요.' }
  }

  const admin = createAdminClient()
  try {
    const apiKey = decryptSecret(encryptedKey)
    const base64 = Buffer.from(await file.arrayBuffer()).toString('base64')
    const extracted = await extractReceiptFields(apiKey, base64, file.type || 'image/jpeg')

    await admin.from('ai_usage_logs').insert({
      school_id: session.school.id,
      profile_id: session.userId,
      tool: 'budget_receipt_ocr',
      key_source: keySource,
      ok: true,
    })

    return { path, amount: extracted.amount, date: extracted.date, vendor: extracted.vendor }
  } catch {
    await admin.from('ai_usage_logs').insert({
      school_id: session.school.id,
      profile_id: session.userId,
      tool: 'budget_receipt_ocr',
      key_source: keySource,
      ok: false,
      error_code: 'gemini_call_failed',
    })
    return { path, error: '자동 인식에 실패했습니다. 아래 칸에 직접 입력해 주세요.' }
  }
}

function sanitizeFileName(name: string): string {
  const cleaned = name.replace(/[^a-zA-Z0-9._-]/g, '_').slice(-80)
  return cleaned || 'receipt'
}
