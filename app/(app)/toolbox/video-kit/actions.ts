'use server'

import { z } from 'zod'
import { generateVideoKit } from '@/lib/ai/gemini'
import { AUDIT_ACTIONS, writeAudit } from '@/lib/security/audit'
import { decryptSecret } from '@/lib/security/crypto'
import { createAdminClient } from '@/lib/supabase/admin'
import { createClient, requireSession } from '@/lib/supabase/server'

const inputSchema = z.object({
  course: z.string().min(1).max(20),
  subject: z.string().min(1).max(40),
  topic: z.string().min(1).max(100),
  level: z.coerce.number().int().min(1).max(3) as z.ZodType<1 | 2 | 3>,
  videoTitle: z.string().min(1).max(200),
  videoUrl: z.string().url().max(500).refine((value) => /^https:\/\/(www\.)?youtube\.com\/watch\?v=[\w-]+$/.test(value), '유튜브 영상 주소만 사용할 수 있습니다.'),
  durationSec: z.coerce.number().int().min(0).max(14_400),
  keySource: z.enum(['school', 'personal']).default('school'),
  confirmed: z.literal('yes'),
})

export type VideoKitState = { result?: string; error?: string }

export async function createVideoKit(_prev: VideoKitState, formData: FormData): Promise<VideoKitState> {
  const session = await requireSession()
  const parsed = inputSchema.safeParse(Object.fromEntries(formData))
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? '입력을 확인해 주세요.' }
  const data = parsed.data
  const encryptedKey = data.keySource === 'personal' ? session.profile.gemini_key_enc : session.school.gemini_key_enc
  if (!encryptedKey) {
    return { error: data.keySource === 'personal' ? '개인 Gemini 키가 없습니다. 내 설정에서 등록하거나 학교 공용 키를 선택해 주세요.' : '학교 공용 Gemini 키가 없습니다. 학교 관리에서 등록하거나 개인 키를 선택해 주세요.' }
  }

  const admin = createAdminClient()
  try {
    const result = await generateVideoKit(decryptSecret(encryptedKey), data)
    await admin.from('ai_usage_logs').insert({
      school_id: session.school.id, profile_id: session.userId, tool: 'video_kit', key_source: data.keySource, ok: true,
    })
    await writeAudit({
      schoolId: session.school.id, actorId: session.userId, actorName: session.profile.name,
      action: AUDIT_ACTIONS.aiRequest, meta: { tool: 'video_kit', keySource: data.keySource, ok: true },
    })
    const supabase = await createClient()
    const { error } = await supabase.from('personal_drafts').insert({
      school_id: session.school.id, owner_id: session.userId, tool: 'video_kit',
      title: `${data.subject} · ${data.topic}`.slice(0, 120), content: result,
      meta: { videoTitle: data.videoTitle, videoUrl: data.videoUrl, durationSec: data.durationSec, level: data.level },
    })
    return error ? { result, error: '결과는 만들었지만 개인 초안으로 저장하지 못했습니다.' } : { result }
  } catch {
    await admin.from('ai_usage_logs').insert({
      school_id: session.school.id, profile_id: session.userId, tool: 'video_kit', key_source: data.keySource, ok: false, error_code: 'generation_failed',
    })
    await writeAudit({
      schoolId: session.school.id, actorId: session.userId, actorName: session.profile.name,
      action: AUDIT_ACTIONS.aiRequest, meta: { tool: 'video_kit', keySource: data.keySource, ok: false },
    })
    return { error: '생성하지 못했습니다. 잠시 후 다시 시도해 주세요.' }
  }
}
