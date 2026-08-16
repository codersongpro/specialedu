'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { AUDIT_ACTIONS, writeAudit } from '@/lib/security/audit'
import { encryptSecret } from '@/lib/security/crypto'
import { createClient, isAdmin, requireSession } from '@/lib/supabase/server'

const ProtocolInput = z.object({
  studentId: z.string().uuid('학생을 골라 주세요'),
  category: z.enum(['seizure', 'allergy', 'dysphagia', 'other']),
  title: z.string().min(1, '제목을 적어 주세요').max(80),
  content: z.string().min(1, '대응 절차를 적어 주세요').max(1000),
})

export interface ProtocolResult {
  ok?: boolean
  error?: string
}

/** 안전 프로토콜 추가·수정 — 관리자만. 정확성이 응급 상황과 직결돼 함부로 열지 않는다. */
export async function saveProtocol(
  id: string | null,
  input: z.input<typeof ProtocolInput>,
): Promise<ProtocolResult> {
  const session = await requireSession()
  if (!isAdmin(session.profile)) return { error: '관리자만 등록할 수 있습니다' }

  const parsed = ProtocolInput.safeParse(input)
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? '입력을 확인하세요' }

  const supabase = await createClient()
  const row = {
    school_id: session.school.id,
    student_id: parsed.data.studentId,
    category: parsed.data.category,
    title: parsed.data.title,
    content_enc: encryptSecret(parsed.data.content),
    created_by: session.userId,
  }

  const { error } = id
    ? await supabase.from('safety_protocols').update(row).eq('id', id)
    : await supabase.from('safety_protocols').insert(row)

  if (error) return { error: '저장하지 못했습니다' }

  await writeAudit({
    schoolId: session.school.id,
    actorId: session.userId,
    actorName: session.profile.name,
    action: AUDIT_ACTIONS.safetyProtocolCreate,
    targetTable: 'safety_protocols',
    meta: { category: parsed.data.category },
  })

  revalidatePath('/support/safety')
  return { ok: true }
}

export async function deleteProtocol(id: string): Promise<ProtocolResult> {
  const session = await requireSession()
  if (!isAdmin(session.profile)) return { error: '관리자만 지울 수 있습니다' }

  const supabase = await createClient()
  const { error } = await supabase.from('safety_protocols').delete().eq('id', id)
  if (error) return { error: '지우지 못했습니다' }

  revalidatePath('/support/safety')
  return { ok: true }
}
