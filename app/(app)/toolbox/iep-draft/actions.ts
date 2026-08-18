'use server'

import { z } from 'zod'
import { draftIepGoals } from '@/lib/ai/gemini'
import { loadMaskContext, previewMaskText, type MaskPreviewResult } from '@/lib/ai/mask-context'
import { AUDIT_ACTIONS, writeAudit } from '@/lib/security/audit'
import { decryptSecret } from '@/lib/security/crypto'
import { blockedFindings, maskPII, restorePII } from '@/lib/security/pii'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireSession } from '@/lib/supabase/server'

export type { MaskPreviewResult }

/**
 * 이 도구는 학생을 모른다 — studentId 없이 영역·현재 수준만 받는다.
 * 후보 문장은 저장하지 않는다. 교사가 복사해 /support/iep에 직접 붙여넣는다.
 */
export async function previewMask(text: string): Promise<MaskPreviewResult> {
  const session = await requireSession()
  const ctx = await loadMaskContext(session.school.id, session.school.name)
  return previewMaskText(text, ctx)
}

const DraftInput = z.object({
  areaLabel: z.string().min(1).max(20),
  currentLevel: z.string().min(1, '현재 수준을 적어 주세요').max(500),
})

export interface DraftGoalsResult {
  goals?: string[]
  error?: string
}

export async function draftGoals(input: z.input<typeof DraftInput>): Promise<DraftGoalsResult> {
  const session = await requireSession()
  const parsed = DraftInput.safeParse(input)
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? '입력을 확인하세요' }
  const data = parsed.data

  const ctx = await loadMaskContext(session.school.id, session.school.name)
  const masked = maskPII(data.currentLevel, ctx)

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
    const candidates = await draftIepGoals(apiKey, { areaLabel: data.areaLabel, currentLevel: masked.masked })

    const goals: string[] = []
    for (const candidate of candidates) {
      const restored = restorePII(candidate, masked.tokens)
      if (restored.missing.length > 0) throw new Error('token_restore_failed')
      goals.push(restored.text)
    }

    await admin.from('ai_usage_logs').insert({
      school_id: session.school.id,
      profile_id: session.userId,
      tool: 'iep_goal_draft',
      key_source: keySource,
      masked_count: masked.findings.length,
      ok: true,
    })
    await writeAudit({
      schoolId: session.school.id,
      actorId: session.userId,
      actorName: session.profile.name,
      action: AUDIT_ACTIONS.aiRequest,
      meta: { tool: 'iep_goal_draft', area: data.areaLabel },
    })

    return { goals }
  } catch {
    await admin.from('ai_usage_logs').insert({
      school_id: session.school.id,
      profile_id: session.userId,
      tool: 'iep_goal_draft',
      key_source: keySource,
      masked_count: masked.findings.length,
      ok: false,
      error_code: 'gemini_call_failed',
    })
    return { error: '만들지 못했습니다. 잠시 후 다시 시도해 주세요.' }
  }
}
