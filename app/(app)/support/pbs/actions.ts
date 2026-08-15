'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { AUDIT_ACTIONS, writeAudit } from '@/lib/security/audit'
import { encryptSecret } from '@/lib/security/crypto'
import { createClient, requireSession } from '@/lib/supabase/server'

export interface RecordResult {
  id?: string
  error?: string
}

/**
 * 탭 한 번으로 기록한다 — 학생 + 행동유형만 고르면 이 함수 하나로 끝난다.
 * ABC·메모는 그 뒤에 펼쳐서 saveDetail()로 따로 붙인다.
 */
export async function recordBehavior(studentId: string, categoryId: string): Promise<RecordResult> {
  const session = await requireSession()

  if (!z.string().uuid().safeParse(studentId).success) return { error: '학생을 골라 주세요' }
  if (!z.string().uuid().safeParse(categoryId).success) return { error: '행동유형을 골라 주세요' }

  const supabase = await createClient()
  const { data, error } = await supabase
    .from('pbs_records')
    .insert({
      school_id: session.school.id,
      student_id: studentId,
      category_id: categoryId,
      recorded_by: session.userId,
    })
    .select('id')
    .single()

  if (error || !data) return { error: '기록하지 못했습니다' }

  await writeAudit({
    schoolId: session.school.id,
    actorId: session.userId,
    actorName: session.profile.name,
    action: AUDIT_ACTIONS.pbsRecordCreate,
    targetTable: 'pbs_records',
    targetId: data.id,
  })

  revalidatePath('/support/pbs')
  return { id: data.id }
}

const DetailInput = z.object({
  location: z.string().max(60).optional(),
  antecedent: z.string().max(500).optional(),
  consequence: z.string().max(500).optional(),
  note: z.string().max(500).optional(),
})

export interface DetailResult {
  ok?: boolean
  error?: string
}

/** 방금 만든 기록에 ABC(선행사건·결과)와 메모를 붙인다. 자유 텍스트라 암호화해 저장한다. */
export async function saveDetail(
  id: string,
  input: { location?: string; antecedent?: string; consequence?: string; note?: string },
): Promise<DetailResult> {
  await requireSession()
  if (!z.string().uuid().safeParse(id).success) return { error: '잘못된 요청입니다' }

  const parsed = DetailInput.safeParse(input)
  if (!parsed.success) return { error: '입력을 확인하세요' }

  const supabase = await createClient()
  const { error } = await supabase
    .from('pbs_records')
    .update({
      location: parsed.data.location || null,
      antecedent_enc: parsed.data.antecedent ? encryptSecret(parsed.data.antecedent) : null,
      consequence_enc: parsed.data.consequence ? encryptSecret(parsed.data.consequence) : null,
      note_enc: parsed.data.note ? encryptSecret(parsed.data.note) : null,
    })
    .eq('id', id)

  if (error) return { error: '저장하지 못했습니다' }

  revalidatePath('/support/pbs')
  return { ok: true }
}

/** 기록 지우기 — 작성자 본인 또는 관리자만(RLS가 최종 확인). */
export async function deleteRecord(formData: FormData): Promise<void> {
  await requireSession()
  const id = String(formData.get('id') ?? '')
  if (!id) return

  const supabase = await createClient()
  await supabase.from('pbs_records').delete().eq('id', id)
  revalidatePath('/support/pbs')
}
