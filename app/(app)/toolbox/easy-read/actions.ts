'use server'

import { z } from 'zod'
import { matchPictograms, pictogramImageUrl } from '@/lib/ai/arasaac'
import { generateEasyRead, type EasyReadLevel } from '@/lib/ai/gemini'
import { AUDIT_ACTIONS, writeAudit } from '@/lib/security/audit'
import { decryptSecret } from '@/lib/security/crypto'
import { blockedFindings, maskPII, restorePII, type Confidence, type PiiKind } from '@/lib/security/pii'
import { createAdminClient } from '@/lib/supabase/admin'
import { createClient, requireSession } from '@/lib/supabase/server'

/**
 * 개인정보가 실제로 Google 에 도달하지 않게 막는 4겹 방어 중 2·3·4겹이
 * 여기 있다(1겹 — 이름 입력 칸 자체가 없는 템플릿 폼 — 은 화면 쪽 설계).
 *
 *   2겹 — previewMask(): 자유 텍스트만 마스킹해 미리 보여준다
 *   3겹 — generateNotice() 호출 전, 화면에서 사람이 미리보기를 확인한다
 *   4겹 — blockedFindings(): 주민번호·계좌번호는 무조건 막는다(우회 불가)
 */

async function loadMaskContext(schoolId: string, schoolName: string) {
  const supabase = await createClient()
  const [{ data: staff }, { data: departments }] = await Promise.all([
    supabase.from('profiles').select('name').eq('school_id', schoolId),
    supabase.from('departments').select('name').eq('school_id', schoolId),
  ])
  return {
    staffNames: (staff ?? []).map((s) => s.name),
    orgNames: [schoolName, ...(departments ?? []).map((d) => d.name)],
  }
}

export interface MaskPreviewFinding {
  original: string
  kind: PiiKind
  confidence: Confidence
}

export interface MaskPreviewResult {
  masked: string
  findings: MaskPreviewFinding[]
  blocked: boolean
}

/** 안내사항 입력란 아래 "이렇게 가려서 보냅니다" 미리보기용. */
export async function previewMask(text: string): Promise<MaskPreviewResult> {
  const session = await requireSession()
  if (!text.trim()) return { masked: '', findings: [], blocked: false }

  const ctx = await loadMaskContext(session.school.id, session.school.name)
  const result = maskPII(text, ctx)

  return {
    masked: result.masked,
    findings: result.findings.map((f) => ({
      original: f.original,
      kind: f.kind,
      confidence: f.confidence,
    })),
    blocked: blockedFindings(result.findings).length > 0,
  }
}

const NoticeInput = z.object({
  noticeType: z.string().min(1).max(20),
  title: z.string().min(1, '제목을 적어 주세요').max(120),
  date: z.string().optional(),
  place: z.string().max(120).optional(),
  items: z.array(z.string().max(40)).max(20),
  audience: z.string().min(1, '대상을 골라 주세요').max(60),
  level: z.union([z.literal(1), z.literal(2), z.literal(3)]),
  detail: z.string().max(1000),
})

export interface NoticeResult {
  text?: string
  keywords?: string[]
  pictograms?: Array<{ keyword: string; url: string | null }>
  error?: string
}

export async function generateNotice(input: z.input<typeof NoticeInput>): Promise<NoticeResult> {
  const session = await requireSession()

  const parsed = NoticeInput.safeParse(input)
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? '입력을 확인하세요' }
  const data = parsed.data

  const ctx = await loadMaskContext(session.school.id, session.school.name)
  const masked = maskPII(data.detail, ctx)

  if (blockedFindings(masked.findings).length > 0) {
    return {
      error: '주민등록번호나 계좌번호로 보이는 내용이 있어 보낼 수 없습니다. 안내사항에서 지워 주세요.',
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
    const generated = await generateEasyRead(apiKey, {
      noticeType: data.noticeType,
      title: data.title,
      date: data.date || null,
      place: data.place || null,
      items: data.items,
      audience: data.audience,
      level,
      detail: masked.masked,
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
      tool: 'easy_read_notice',
      key_source: keySource,
      masked_count: masked.findings.length,
      ok: true,
    })
    await writeAudit({
      schoolId: session.school.id,
      actorId: session.userId,
      actorName: session.profile.name,
      action: AUDIT_ACTIONS.aiRequest,
      meta: { tool: 'easy_read_notice', level },
    })

    return { text: restored.text, keywords: generated.keywords, pictograms }
  } catch {
    await admin.from('ai_usage_logs').insert({
      school_id: session.school.id,
      profile_id: session.userId,
      tool: 'easy_read_notice',
      key_source: keySource,
      masked_count: masked.findings.length,
      ok: false,
      error_code: 'gemini_call_failed',
    })
    return { error: '생성하지 못했습니다. 잠시 후 다시 시도해 주세요.' }
  }
}
