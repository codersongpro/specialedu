'use server'

import { z } from 'zod'
import { generateLessonAdaptation } from '@/lib/ai/gemini'
import { decryptSecret } from '@/lib/security/crypto'
import { blockedFindings, maskFields } from '@/lib/security/pii'
import { AUDIT_ACTIONS, writeAudit } from '@/lib/security/audit'
import { validateLessonUpload } from '@/lib/lesson-adapt/upload'
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
  keySource: z.enum(['school', 'personal']).default('school'),
  confirmed: z.literal('yes'),
})

export type LessonAdaptState = { result?: string; error?: string }

export type LessonMaskPreview = { masked: string; findings: string[]; blocked: boolean }

export async function previewLessonMask(input: Record<string, string>): Promise<LessonMaskPreview> {
  const session = await requireSession()
  const supabase = await createClient()
  const [{ data: staff }, { data: departments }] = await Promise.all([
    supabase.from('profiles').select('name').eq('school_id', session.school.id),
    supabase.from('departments').select('name').eq('school_id', session.school.id),
  ])
  const masked = maskFields(
    { topic: input.topic ?? '', objective: input.objective ?? '', material: input.material ?? '', supplies: input.supplies ?? '' },
    { staffNames: (staff ?? []).map((item) => item.name), orgNames: [session.school.name, ...(departments ?? []).map((item) => item.name)] },
  )
  return {
    masked: [masked.fields.topic, masked.fields.objective, masked.fields.material, masked.fields.supplies].join('\n'),
    findings: masked.findings.map((item) => item.kind),
    blocked: blockedFindings(masked.findings).length > 0,
  }
}

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
  const attachments = formData.getAll('attachments').filter((item): item is File => item instanceof File && item.size > 0)
  if (attachments.length > 3) return { error: '첨부 자료는 최대 3개까지 올릴 수 있습니다.' }
  for (const file of attachments) {
    const validation = validateLessonUpload({
      name: file.name,
      type: file.type,
      size: file.size,
      bytes: new Uint8Array(await file.arrayBuffer()),
    })
    if (!validation.ok) return { error: `${file.name}: ${validation.error}` }
  }
  const masked = maskFields(
    { topic: data.topic, objective: data.objective, material: data.material, supplies: data.supplies },
    { staffNames: (staff ?? []).map((item) => item.name), orgNames: [session.school.name, ...(departments ?? []).map((item) => item.name)] },
  )
  if (blockedFindings(masked.findings).length > 0) {
    return { error: '주민등록번호나 계좌번호로 보이는 내용이 있어 보낼 수 없습니다.' }
  }

  const keySource = data.keySource
  const encryptedKey = keySource === 'personal' ? session.profile.gemini_key_enc : session.school.gemini_key_enc
  if (!encryptedKey) return { error: keySource === 'personal' ? '개인 Gemini 키가 없습니다. 내 설정에서 등록하거나 학교 공용 키를 선택해 주세요.' : '학교 공용 Gemini 키가 없습니다. 학교 관리에서 등록하거나 개인 키를 선택해 주세요.' }

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
    }, await Promise.all(attachments.map(async (file) => ({
      mimeType: file.type,
      data: Buffer.from(await file.arrayBuffer()).toString('base64'),
    }))))
    const admin = createAdminClient()
    await admin.from('ai_usage_logs').insert({
      school_id: session.school.id,
      profile_id: session.userId,
      tool: 'lesson_adapt',
      key_source: keySource,
      masked_count: masked.findings.length,
      ok: true,
    })
    await writeAudit({
      schoolId: session.school.id, actorId: session.userId, actorName: session.profile.name,
      action: AUDIT_ACTIONS.aiRequest, meta: { tool: 'lesson_adapt', keySource, ok: true },
    })
    const { error } = await supabase.from('personal_drafts').insert({
      school_id: session.school.id,
      owner_id: session.userId,
      tool: 'lesson_adapt',
      title: `${data.subject} · ${data.topic}`.slice(0, 120),
      content: result,
      meta: { level: data.level, duration: data.duration, attachmentCount: attachments.length },
    })
    if (error) return { result, error: '결과는 만들었지만 개인 초안으로 저장하지 못했습니다.' }
    return { result }
  } catch {
    const admin = createAdminClient()
    await admin.from('ai_usage_logs').insert({
      school_id: session.school.id, profile_id: session.userId, tool: 'lesson_adapt', key_source: keySource, masked_count: masked.findings.length, ok: false, error_code: 'generation_failed',
    })
    await writeAudit({
      schoolId: session.school.id, actorId: session.userId, actorName: session.profile.name,
      action: AUDIT_ACTIONS.aiRequest, meta: { tool: 'lesson_adapt', keySource, ok: false },
    })
    return { error: '생성하지 못했습니다. 잠시 후 다시 시도해 주세요.' }
  }
}
