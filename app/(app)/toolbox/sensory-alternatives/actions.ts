'use server'

import { z } from 'zod'
import { generateSensoryAlternatives } from '@/lib/ai/gemini'
import { loadMaskContext, previewMaskText, type MaskPreviewResult } from '@/lib/ai/mask-context'
import { AUDIT_ACTIONS, writeAudit } from '@/lib/security/audit'
import { decryptSecret } from '@/lib/security/crypto'
import { blockedFindings, maskFields, restorePII } from '@/lib/security/pii'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireSession } from '@/lib/supabase/server'
import { SENSITIVITY_LABEL, SENSITIVITY_VALUES_LIST } from './labels'

export type { MaskPreviewResult }

/** 입력란 아래 "이렇게 가려서 보냅니다" 미리보기용 — easy-read와 동일 흐름. */
export async function previewMask(text: string): Promise<MaskPreviewResult> {
  const session = await requireSession()
  const ctx = await loadMaskContext(session.school.id, session.school.name)
  return previewMaskText(text, ctx)
}

const AlternativesInput = z.object({
  activity: z.string().min(1, '원래 활동을 적어 주세요').max(120),
  sensitivities: z.array(z.enum(SENSITIVITY_VALUES_LIST)).min(1, '감각특성을 하나 이상 골라 주세요'),
  note: z.string().max(500).optional(),
})

export interface SensoryAlternativesResult {
  alternatives?: string[]
  error?: string
}

/** 저장하지 않는 무상태 도구 — 만든 대안은 화면에서 복사해 쓴다. */
export async function draftAlternatives(input: z.input<typeof AlternativesInput>): Promise<SensoryAlternativesResult> {
  const session = await requireSession()
  const parsed = AlternativesInput.safeParse(input)
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? '입력을 확인하세요' }
  const data = parsed.data

  const ctx = await loadMaskContext(session.school.id, session.school.name)
  const masked = maskFields({ activity: data.activity, note: data.note ?? '' }, ctx)

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
    const candidates = await generateSensoryAlternatives(apiKey, {
      activity: masked.fields.activity,
      sensitivities: data.sensitivities.map((s) => SENSITIVITY_LABEL[s]),
      note: masked.fields.note,
    })

    const alternatives: string[] = []
    for (const candidate of candidates) {
      const restored = restorePII(candidate, masked.tokens)
      if (restored.missing.length > 0) throw new Error('token_restore_failed')
      alternatives.push(restored.text)
    }

    await admin.from('ai_usage_logs').insert({
      school_id: session.school.id,
      profile_id: session.userId,
      tool: 'sensory_alternatives',
      key_source: keySource,
      masked_count: masked.findings.length,
      ok: true,
    })
    await writeAudit({
      schoolId: session.school.id,
      actorId: session.userId,
      actorName: session.profile.name,
      action: AUDIT_ACTIONS.aiRequest,
      meta: { tool: 'sensory_alternatives' },
    })

    return { alternatives }
  } catch {
    await admin.from('ai_usage_logs').insert({
      school_id: session.school.id,
      profile_id: session.userId,
      tool: 'sensory_alternatives',
      key_source: keySource,
      masked_count: masked.findings.length,
      ok: false,
      error_code: 'gemini_call_failed',
    })
    return { error: '만들지 못했습니다. 잠시 후 다시 시도해 주세요.' }
  }
}
