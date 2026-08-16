'use server'

import { z } from 'zod'
import { generateWorkflowDraft } from '@/lib/ai/gemini'
import { AUDIT_ACTIONS, writeAudit } from '@/lib/security/audit'
import { decryptSecret } from '@/lib/security/crypto'
import { blockedFindings, maskPII } from '@/lib/security/pii'
import { createAdminClient } from '@/lib/supabase/admin'
import { createClient, requireSession } from '@/lib/supabase/server'
import type { WorkflowTool } from '@/lib/workflow/prompt'

const inputSchema = z.object({
  tool: z.enum(['document_checklist', 'trip_plan', 'meeting_notes']),
  title: z.string().min(1).max(120),
  source: z.string().min(1).max(6000),
  keySource: z.enum(['school', 'personal']).default('school'),
  confirmed: z.literal('yes'),
})
export type WorkflowState = { result?: string; error?: string }

export async function createWorkflowDraft(_prev: WorkflowState, formData: FormData): Promise<WorkflowState> {
  const session = await requireSession()
  const parsed = inputSchema.safeParse(Object.fromEntries(formData))
  if (!parsed.success) return { error: '입력과 외부 전송 확인 항목을 확인해 주세요.' }
  const data = parsed.data
  const supabase = await createClient()
  const [{ data: staff }, { data: departments }] = await Promise.all([
    supabase.from('profiles').select('name').eq('school_id', session.school.id),
    supabase.from('departments').select('name').eq('school_id', session.school.id),
  ])
  const masked = maskPII(data.source, {
    staffNames: (staff ?? []).map((item) => item.name),
    orgNames: [session.school.name, ...(departments ?? []).map((item) => item.name)],
  })
  if (blockedFindings(masked.findings).length) return { error: '주민등록번호나 계좌번호로 보이는 내용이 있어 보낼 수 없습니다.' }
  const encryptedKey = data.keySource === 'personal' ? session.profile.gemini_key_enc : session.school.gemini_key_enc
  if (!encryptedKey) return { error: data.keySource === 'personal' ? '개인 Gemini 키가 없습니다.' : '학교 공용 Gemini 키가 없습니다.' }
  const admin = createAdminClient()
  try {
    const result = await generateWorkflowDraft(decryptSecret(encryptedKey), data.tool as WorkflowTool, masked.masked)
    await admin.from('ai_usage_logs').insert({ school_id: session.school.id, profile_id: session.userId, tool: data.tool, key_source: data.keySource, masked_count: masked.findings.length, ok: true })
    await writeAudit({ schoolId: session.school.id, actorId: session.userId, actorName: session.profile.name, action: AUDIT_ACTIONS.aiRequest, meta: { tool: data.tool, keySource: data.keySource, ok: true } })
    const { error } = await supabase.from('personal_drafts').insert({ school_id: session.school.id, owner_id: session.userId, tool: data.tool, title: data.title, content: result, meta: { maskedCount: masked.findings.length } })
    return error ? { result, error: '결과는 만들었지만 개인 초안으로 저장하지 못했습니다.' } : { result }
  } catch {
    await admin.from('ai_usage_logs').insert({ school_id: session.school.id, profile_id: session.userId, tool: data.tool, key_source: data.keySource, masked_count: masked.findings.length, ok: false, error_code: 'generation_failed' })
    return { error: '생성하지 못했습니다. 잠시 후 다시 시도해 주세요.' }
  }
}
