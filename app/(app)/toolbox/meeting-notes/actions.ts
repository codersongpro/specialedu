'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { summarizeMeetingNotes } from '@/lib/ai/gemini'
import { loadMaskContext, previewMaskText, type MaskPreviewResult } from '@/lib/ai/mask-context'
import { AUDIT_ACTIONS, writeAudit } from '@/lib/security/audit'
import { decryptSecret, encryptSecret } from '@/lib/security/crypto'
import { blockedFindings, maskFields, restorePII } from '@/lib/security/pii'
import { createAdminClient } from '@/lib/supabase/admin'
import { createClient, requireSession } from '@/lib/supabase/server'

export type { MaskPreviewResult }

/** 원본 내용 입력란 아래 "이렇게 가려서 보냅니다" 미리보기용 — easy-read와 동일 흐름. */
export async function previewMask(text: string): Promise<MaskPreviewResult> {
  const session = await requireSession()
  const ctx = await loadMaskContext(session.school.id, session.school.name)
  return previewMaskText(text, ctx)
}

const NoteInput = z.object({
  title: z.string().min(1, '제목을 적어 주세요').max(120),
  meetingDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, '날짜 형식이 올바르지 않습니다'),
  category: z.string().max(60).optional(),
  rawText: z.string().min(1, '내용을 적어 주세요').max(4000),
})

export interface SummarizeResult {
  summary?: string
  error?: string
}

/**
 * 협의록 요약 + 저장 — 단일 액션. easy-read의 generateNotice()와 정확히
 * 같은 흐름을 따른다: maskFields → blockedFindings 차단 → Gemini →
 * restorePII → 원본·요약 각각 암호화해 저장.
 */
export async function summarizeMeetingNote(input: z.input<typeof NoteInput>): Promise<SummarizeResult> {
  const session = await requireSession()
  const parsed = NoteInput.safeParse(input)
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? '입력을 확인하세요' }
  const data = parsed.data

  const ctx = await loadMaskContext(session.school.id, session.school.name)
  const masked = maskFields({ title: data.title, rawText: data.rawText }, ctx)

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
    const summaryMasked = await summarizeMeetingNotes(apiKey, {
      title: masked.fields.title,
      category: data.category || null,
      rawText: masked.fields.rawText,
    })

    const restored = restorePII(summaryMasked, masked.tokens)
    if (restored.missing.length > 0) {
      throw new Error('token_restore_failed')
    }

    const supabase = await createClient()
    const { data: inserted, error } = await supabase
      .from('meeting_notes')
      .insert({
        school_id: session.school.id,
        title: data.title,
        meeting_date: data.meetingDate,
        category: data.category || null,
        raw_text_enc: encryptSecret(data.rawText),
        summary_enc: encryptSecret(restored.text),
        created_by: session.userId,
      })
      .select('id')
      .single()

    if (error || !inserted) throw new Error('insert_failed')

    await admin.from('ai_usage_logs').insert({
      school_id: session.school.id,
      profile_id: session.userId,
      tool: 'meeting_note_summary',
      key_source: keySource,
      masked_count: masked.findings.length,
      ok: true,
    })
    await writeAudit({
      schoolId: session.school.id,
      actorId: session.userId,
      actorName: session.profile.name,
      action: AUDIT_ACTIONS.meetingNoteSave,
      targetTable: 'meeting_notes',
      targetId: inserted.id,
    })

    revalidatePath('/toolbox/meeting-notes')
    return { summary: restored.text }
  } catch {
    await admin.from('ai_usage_logs').insert({
      school_id: session.school.id,
      profile_id: session.userId,
      tool: 'meeting_note_summary',
      key_source: keySource,
      masked_count: masked.findings.length,
      ok: false,
      error_code: 'gemini_call_failed',
    })
    return { error: '요약하지 못했습니다. 잠시 후 다시 시도해 주세요.' }
  }
}

export interface SimpleResult {
  ok?: true
  error?: string
}

/** 삭제 — 작성자 또는 관리자만(RLS가 최종 확인). */
export async function deleteMeetingNote(id: string): Promise<SimpleResult> {
  const session = await requireSession()
  if (!z.string().uuid().safeParse(id).success) return { error: '잘못된 요청입니다' }

  const supabase = await createClient()
  const { error } = await supabase.from('meeting_notes').delete().eq('id', id)
  if (error) return { error: '지우지 못했습니다' }

  await writeAudit({
    schoolId: session.school.id,
    actorId: session.userId,
    actorName: session.profile.name,
    action: AUDIT_ACTIONS.meetingNoteDelete,
    targetTable: 'meeting_notes',
    targetId: id,
  })

  revalidatePath('/toolbox/meeting-notes')
  return { ok: true }
}
