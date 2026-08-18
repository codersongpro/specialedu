'use server'

import { z } from 'zod'
import { matchPictograms, pictogramImageUrl } from '@/lib/ai/arasaac'
import { generateVisualSchedule } from '@/lib/ai/gemini'
import { loadMaskContext, previewMaskText, type MaskPreviewResult } from '@/lib/ai/mask-context'
import { AUDIT_ACTIONS, writeAudit } from '@/lib/security/audit'
import { decryptSecret } from '@/lib/security/crypto'
import { blockedFindings, maskPII, restorePII } from '@/lib/security/pii'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireSession } from '@/lib/supabase/server'

export type { MaskPreviewResult }

/** 활동 입력란 아래 "이렇게 가려서 보냅니다" 미리보기용 — easy-read와 동일 흐름. */
export async function previewMask(text: string): Promise<MaskPreviewResult> {
  const session = await requireSession()
  const ctx = await loadMaskContext(session.school.id, session.school.name)
  return previewMaskText(text, ctx)
}

const ScheduleInput = z.object({
  title: z.string().min(1, '일과 제목을 적어 주세요').max(120),
  items: z
    .array(
      z.object({
        time: z.string().max(20).optional(),
        activity: z.string().min(1).max(60),
      }),
    )
    .min(1, '활동을 하나 이상 적어 주세요')
    .max(12, '활동은 최대 12개까지 만들 수 있습니다'),
})

export interface ScheduleResultItem {
  time: string
  label: string
  pictogramUrl: string | null
}

export interface VisualScheduleResult {
  items?: ScheduleResultItem[]
  error?: string
}

// 활동 텍스트가 실제로 담을 일이 없는 구분자 — easy-read의 준비물 배열 처리와 동일한 트릭.
const ITEMS_SEP = '␞'

/** 저장하지 않는 무상태 도구 — 만든 일과표는 화면에서 인쇄해 쓴다. */
export async function generateSchedule(input: z.input<typeof ScheduleInput>): Promise<VisualScheduleResult> {
  const session = await requireSession()
  const parsed = ScheduleInput.safeParse(input)
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? '입력을 확인하세요' }
  const data = parsed.data

  const ctx = await loadMaskContext(session.school.id, session.school.name)
  const combined = data.items.map((i) => i.activity).join(ITEMS_SEP)
  const masked = maskPII(combined, ctx)

  if (blockedFindings(masked.findings).length > 0) {
    return {
      error: '주민등록번호나 계좌번호로 보이는 내용이 있어 보낼 수 없습니다. 활동 이름을 확인해 지워 주세요.',
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
  const maskedActivities = masked.masked.split(ITEMS_SEP)

  try {
    const apiKey = decryptSecret(encryptedKey)
    const generated = await generateVisualSchedule(apiKey, { title: data.title, items: maskedActivities })

    if (generated.length !== data.items.length) {
      throw new Error('schedule_length_mismatch')
    }

    const restoredLabels: string[] = []
    for (const activity of generated) {
      const restored = restorePII(activity.label, masked.tokens)
      if (restored.missing.length > 0) throw new Error('token_restore_failed')
      restoredLabels.push(restored.text)
    }

    const keywords = generated.map((a) => a.keyword)
    const matches = keywords.length > 0 ? await matchPictograms(keywords) : []
    const urlByKeyword = new Map(matches.map((m) => [m.keyword, m.id ? pictogramImageUrl(m.id) : null]))

    const items: ScheduleResultItem[] = data.items.map((item, i) => ({
      time: item.time ?? '',
      label: restoredLabels[i] ?? item.activity,
      pictogramUrl: urlByKeyword.get(generated[i]!.keyword) ?? null,
    }))

    await admin.from('ai_usage_logs').insert({
      school_id: session.school.id,
      profile_id: session.userId,
      tool: 'visual_schedule',
      key_source: keySource,
      masked_count: masked.findings.length,
      ok: true,
    })
    await writeAudit({
      schoolId: session.school.id,
      actorId: session.userId,
      actorName: session.profile.name,
      action: AUDIT_ACTIONS.aiRequest,
      meta: { tool: 'visual_schedule', itemCount: items.length },
    })

    return { items }
  } catch {
    await admin.from('ai_usage_logs').insert({
      school_id: session.school.id,
      profile_id: session.userId,
      tool: 'visual_schedule',
      key_source: keySource,
      masked_count: masked.findings.length,
      ok: false,
      error_code: 'gemini_call_failed',
    })
    return { error: '만들지 못했습니다. 잠시 후 다시 시도해 주세요.' }
  }
}
