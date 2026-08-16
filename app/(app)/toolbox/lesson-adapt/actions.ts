'use server'

import { z } from 'zod'
import { generateLessonAdaptation } from '@/lib/ai/gemini'
import { decryptSecret } from '@/lib/security/crypto'
import { blockedFindings, maskFields } from '@/lib/security/pii'
import { createAdminClient } from '@/lib/supabase/admin'
import { createClient, requireSession } from '@/lib/supabase/server'

const inputSchema = z.object({
  course: z.string().min(1).max(20),
  subject: z.string().min(1).max(40),
  topic: z.string().min(1).max(100),
  objective: z.string().min(1).max(300),
  material: z.string().min(1).max(3000),
  level: z.coerce.number().int().min(1).max(3) as z.ZodType<1 | 2 | 3>,
  duration: z.coerce.number().int().min(10).max(240),
  supplies: z.string().max(300),
  confirmed: z.literal('yes'),
})

export type LessonAdaptState = { result?: string; error?: string }

export async function adaptLesson(_prev: LessonAdaptState, formData: FormData): Promise<LessonAdaptState> {
  const session = await requireSession()
  const parsed = inputSchema.safeParse(Object.fromEntries(formData))
  if (!parsed.success) return { error: '입력과 개인정보 확인 항목을 확인해 주세요.' }

  const supabase = await createClient()
  const [{ data: staff }, { data: departments }] = await Promise.all([
    supabase.from('profiles').select('name').eq('school_id', session.school.id),
    supabase.from('departments').select('name').eq('school_id', session.school.id),
  ])
  const data = parsed.data
  const masked = maskFields(
    { topic: data.topic, objective: data.objective, material: data.material, supplies: data.supplies },
    { staffNames: (staff ?? []).map((item) => item.name), orgNames: [session.school.name, ...(departments ?? []).map((item) => item.name)] },
  )
  if (blockedFindings(masked.findings).length > 0) {
    return { error: '주민등록번호나 계좌번호로 보이는 내용이 있어 보낼 수 없습니다.' }
  }

  const encryptedKey = session.profile.gemini_key_enc ?? session.school.gemini_key_enc
  if (!encryptedKey) return { error: 'Gemini 키가 없습니다. 내 설정 또는 학교 관리에서 등록해 주세요.' }

  try {
    const result = await generateLessonAdaptation(decryptSecret(encryptedKey), {
      course: data.course,
      subject: data.subject,
      topic: masked.fields.topic,
      objective: masked.fields.objective,
      material: masked.fields.material,
      level: data.level,
      duration: data.duration,
      supplies: masked.fields.supplies,
    })
    const admin = createAdminClient()
    await admin.from('ai_usage_logs').insert({
      school_id: session.school.id,
      profile_id: session.userId,
      tool: 'lesson_adapt',
      key_source: session.profile.gemini_key_enc ? 'personal' : 'school',
      masked_count: masked.findings.length,
      ok: true,
    })
    const { error } = await supabase.from('personal_drafts').insert({
      school_id: session.school.id,
      owner_id: session.userId,
      tool: 'lesson_adapt',
      title: `${data.subject} · ${data.topic}`.slice(0, 120),
      content: result,
      meta: { level: data.level, duration: data.duration },
    })
    if (error) return { result, error: '결과는 만들었지만 개인 초안으로 저장하지 못했습니다.' }
    return { result }
  } catch {
    return { error: '생성하지 못했습니다. 잠시 후 다시 시도해 주세요.' }
  }
}
