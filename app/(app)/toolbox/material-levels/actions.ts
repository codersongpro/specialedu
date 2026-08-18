'use server'

import { z } from 'zod'
import { generateMaterialLevels } from '@/lib/ai/gemini'
import { loadMaskContext, previewMaskText, type MaskPreviewResult } from '@/lib/ai/mask-context'
import { AUDIT_ACTIONS, writeAudit } from '@/lib/security/audit'
import { decryptSecret } from '@/lib/security/crypto'
import { blockedFindings, maskFields, restorePII } from '@/lib/security/pii'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireSession } from '@/lib/supabase/server'

export type { MaskPreviewResult }

/** 원본 자료 입력란 아래 "이렇게 가려서 보냅니다" 미리보기용 — easy-read와 동일 흐름. */
export async function previewMask(text: string): Promise<MaskPreviewResult> {
  const session = await requireSession()
  const ctx = await loadMaskContext(session.school.id, session.school.name)
  return previewMaskText(text, ctx)
}

const MaterialInput = z.object({
  text: z.string().min(1, '원본 자료를 적어 주세요').max(3000),
  subject: z.string().max(40).optional(),
})

export interface MaterialLevelsResult {
  high?: string
  mid?: string
  low?: string
  error?: string
}

/** 저장하지 않는 무상태 도구 — 만든 3단계 결과는 화면에서 복사해 쓴다. */
export async function convertLevels(input: z.input<typeof MaterialInput>): Promise<MaterialLevelsResult> {
  const session = await requireSession()
  const parsed = MaterialInput.safeParse(input)
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? '입력을 확인하세요' }
  const data = parsed.data

  const ctx = await loadMaskContext(session.school.id, session.school.name)
  const masked = maskFields({ text: data.text, subject: data.subject ?? '' }, ctx)

  if (blockedFindings(masked.findings).length > 0) {
    return {
      error: '주민등록번호나 계좌번호로 보이는 내용이 있어 보낼 수 없습니다. 입력 내용을 확인해 지워 주세요.',
    }
  }

  const keySource: 'personal' | 'school' | null = session.profile.gemini_key_enc
    ? 'personal'
    : session.school.gemini_key_enc
      ? 'school'
      : null
  const encryptedKey = session.profile.gemini_key_enc ?? session.school.gemini_key_enc

  if (!encryptedKey || !keySource) {
    return { error: '등록된 Gemini 키가 없습니다. 내 설정 또는 학교 관리에서 키를 등록해 주세요.' }
  }

  const admin = createAdminClient()

  try {
    const apiKey = decryptSecret(encryptedKey)
    const generated = await generateMaterialLevels(apiKey, {
      text: masked.fields.text,
      subject: masked.fields.subject || null,
    })

    const results: Record<'high' | 'mid' | 'low', string> = { high: '', mid: '', low: '' }
    for (const key of ['high', 'mid', 'low'] as const) {
      const restored = restorePII(generated[key], masked.tokens)
      if (restored.missing.length > 0) throw new Error('token_restore_failed')
      results[key] = restored.text
    }

    await admin.from('ai_usage_logs').insert({
      school_id: session.school.id,
      profile_id: session.userId,
      tool: 'material_levels',
      key_source: keySource,
      masked_count: masked.findings.length,
      ok: true,
    })
    await writeAudit({
      schoolId: session.school.id,
      actorId: session.userId,
      actorName: session.profile.name,
      action: AUDIT_ACTIONS.aiRequest,
      meta: { tool: 'material_levels' },
    })

    return results
  } catch {
    await admin.from('ai_usage_logs').insert({
      school_id: session.school.id,
      profile_id: session.userId,
      tool: 'material_levels',
      key_source: keySource,
      masked_count: masked.findings.length,
      ok: false,
      error_code: 'gemini_call_failed',
    })
    return { error: '만들지 못했습니다. 잠시 후 다시 시도해 주세요.' }
  }
}
