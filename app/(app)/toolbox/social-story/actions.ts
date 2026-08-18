'use server'

import { z } from 'zod'
import { matchPictograms, pictogramImageUrl } from '@/lib/ai/arasaac'
import { generateSocialStory, type EasyReadLevel } from '@/lib/ai/gemini'
import { loadMaskContext, previewMaskText, type MaskPreviewResult } from '@/lib/ai/mask-context'
import { AUDIT_ACTIONS, writeAudit } from '@/lib/security/audit'
import { decryptSecret } from '@/lib/security/crypto'
import { blockedFindings, maskPII, restorePII } from '@/lib/security/pii'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireSession } from '@/lib/supabase/server'

export type { MaskPreviewResult }

/** 상황 설명 입력란 아래 "이렇게 가려서 보냅니다" 미리보기용 — easy-read와 동일 흐름. */
export async function previewMask(text: string): Promise<MaskPreviewResult> {
  const session = await requireSession()
  const ctx = await loadMaskContext(session.school.id, session.school.name)
  return previewMaskText(text, ctx)
}

const StoryInput = z.object({
  title: z.string().min(1, '제목을 적어 주세요').max(120),
  situation: z.string().min(1, '상황을 적어 주세요').max(1000),
  level: z.union([z.literal(1), z.literal(2), z.literal(3)]),
})

export interface SocialStoryResult {
  text?: string
  keywords?: string[]
  pictograms?: Array<{ keyword: string; url: string | null }>
  error?: string
}

/** 저장하지 않는 무상태 도구 — 만든 이야기는 화면에서 인쇄해 쓴다. */
export async function generateStory(input: z.input<typeof StoryInput>): Promise<SocialStoryResult> {
  const session = await requireSession()
  const parsed = StoryInput.safeParse(input)
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? '입력을 확인하세요' }
  const data = parsed.data

  const ctx = await loadMaskContext(session.school.id, session.school.name)
  const masked = maskPII(data.situation, ctx)

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
  const level: EasyReadLevel = data.level

  try {
    const apiKey = decryptSecret(encryptedKey)
    const generated = await generateSocialStory(apiKey, {
      title: data.title,
      situation: masked.masked,
      level,
    })

    const restored = restorePII(generated.text, masked.tokens)
    if (restored.missing.length > 0) {
      throw new Error('token_restore_failed')
    }

    let pictograms: Array<{ keyword: string; url: string | null }> = []
    if (level === 1 && generated.keywords.length > 0) {
      const matches = await matchPictograms(generated.keywords)
      pictograms = matches.map((m) => ({
        keyword: m.keyword,
        url: m.id ? pictogramImageUrl(m.id) : null,
      }))
    }

    await admin.from('ai_usage_logs').insert({
      school_id: session.school.id,
      profile_id: session.userId,
      tool: 'social_story',
      key_source: keySource,
      masked_count: masked.findings.length,
      ok: true,
    })
    await writeAudit({
      schoolId: session.school.id,
      actorId: session.userId,
      actorName: session.profile.name,
      action: AUDIT_ACTIONS.aiRequest,
      meta: { tool: 'social_story', level },
    })

    return { text: restored.text, keywords: generated.keywords, pictograms }
  } catch {
    await admin.from('ai_usage_logs').insert({
      school_id: session.school.id,
      profile_id: session.userId,
      tool: 'social_story',
      key_source: keySource,
      masked_count: masked.findings.length,
      ok: false,
      error_code: 'gemini_call_failed',
    })
    return { error: '만들지 못했습니다. 잠시 후 다시 시도해 주세요.' }
  }
}
