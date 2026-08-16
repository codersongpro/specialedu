'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { AUDIT_ACTIONS, writeAudit } from '@/lib/security/audit'
import { encryptSecret } from '@/lib/security/crypto'
import { createClient, requireSession } from '@/lib/supabase/server'

const GoalInput = z.object({
  studentId: z.string().uuid('학생을 골라 주세요'),
  area: z.enum(['self_care', 'communication', 'academic', 'social', 'motor', 'other']),
  title: z.string().min(1, '목표를 적어 주세요').max(200),
  termLabel: z.string().min(1, '학기를 적어 주세요').max(40),
})

export interface GoalResult {
  id?: string
  error?: string
}

/** 목표 추가 — 학생·영역·목표 문장·학기만 넣으면 끝난다. */
export async function createGoal(input: z.input<typeof GoalInput>): Promise<GoalResult> {
  const session = await requireSession()
  const parsed = GoalInput.safeParse(input)
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? '입력을 확인하세요' }

  const supabase = await createClient()
  const { data, error } = await supabase
    .from('iep_goals')
    .insert({
      school_id: session.school.id,
      student_id: parsed.data.studentId,
      area: parsed.data.area,
      title: parsed.data.title,
      term_label: parsed.data.termLabel,
      created_by: session.userId,
    })
    .select('id')
    .single()

  if (error || !data) return { error: '저장하지 못했습니다' }

  await writeAudit({
    schoolId: session.school.id,
    actorId: session.userId,
    actorName: session.profile.name,
    action: AUDIT_ACTIONS.iepGoalCreate,
    targetTable: 'iep_goals',
    targetId: data.id,
  })

  revalidatePath('/support/iep')
  return { id: data.id }
}

const StatusInput = z.enum(['active', 'achieved', 'discontinued'])

export interface SimpleResult {
  ok?: boolean
  error?: string
}

/** 목표 상태 변경 — 작성자 본인 또는 관리자만(RLS가 최종 확인). */
export async function updateGoalStatus(id: string, status: string): Promise<SimpleResult> {
  await requireSession()
  if (!z.string().uuid().safeParse(id).success) return { error: '잘못된 요청입니다' }
  const parsedStatus = StatusInput.safeParse(status)
  if (!parsedStatus.success) return { error: '잘못된 상태입니다' }

  const supabase = await createClient()
  const { error } = await supabase.from('iep_goals').update({ status: parsedStatus.data }).eq('id', id)
  if (error) return { error: '저장하지 못했습니다' }

  revalidatePath('/support/iep')
  return { ok: true }
}

/** 목표 삭제 — 작성자 본인 또는 관리자만. 딸린 진도 기록도 함께 지워진다. */
export async function deleteGoal(id: string): Promise<SimpleResult> {
  await requireSession()
  if (!z.string().uuid().safeParse(id).success) return { error: '잘못된 요청입니다' }

  const supabase = await createClient()
  const { error } = await supabase.from('iep_goals').delete().eq('id', id)
  if (error) return { error: '지우지 못했습니다' }

  revalidatePath('/support/iep')
  return { ok: true }
}

const ProgressInput = z.object({
  goalId: z.string().uuid('잘못된 요청입니다'),
  level: z.enum(['independent', 'partial_help', 'full_help', 'not_yet']),
  note: z.string().max(500).optional(),
})

/** 진도 기록 — 목표를 고르고 달성도 버튼 하나만 누르면 바로 기록된다. */
export async function recordProgress(input: z.input<typeof ProgressInput>): Promise<GoalResult> {
  const session = await requireSession()
  const parsed = ProgressInput.safeParse(input)
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? '입력을 확인하세요' }

  const supabase = await createClient()
  const { data, error } = await supabase
    .from('iep_progress')
    .insert({
      school_id: session.school.id,
      goal_id: parsed.data.goalId,
      level: parsed.data.level,
      note_enc: parsed.data.note ? encryptSecret(parsed.data.note) : null,
      recorded_by: session.userId,
    })
    .select('id')
    .single()

  if (error || !data) return { error: '기록하지 못했습니다' }

  await writeAudit({
    schoolId: session.school.id,
    actorId: session.userId,
    actorName: session.profile.name,
    action: AUDIT_ACTIONS.iepProgressCreate,
    targetTable: 'iep_progress',
    targetId: data.id,
  })

  revalidatePath('/support/iep')
  return { id: data.id }
}

/** 방금 기록한 진도에 메모를 붙인다. PBS의 saveDetail()과 같은 2단계 방식. */
export async function saveProgressNote(id: string, note: string): Promise<SimpleResult> {
  await requireSession()
  if (!z.string().uuid().safeParse(id).success) return { error: '잘못된 요청입니다' }
  const parsedNote = z.string().max(500).safeParse(note)
  if (!parsedNote.success) return { error: '메모가 너무 깁니다' }

  const supabase = await createClient()
  const { error } = await supabase
    .from('iep_progress')
    .update({ note_enc: parsedNote.data ? encryptSecret(parsedNote.data) : null })
    .eq('id', id)

  if (error) return { error: '저장하지 못했습니다' }

  revalidatePath('/support/iep')
  return { ok: true }
}

/** 진도 기록 삭제 — 작성자 본인 또는 관리자만. */
export async function deleteProgress(id: string): Promise<SimpleResult> {
  await requireSession()
  if (!z.string().uuid().safeParse(id).success) return { error: '잘못된 요청입니다' }

  const supabase = await createClient()
  const { error } = await supabase.from('iep_progress').delete().eq('id', id)
  if (error) return { error: '지우지 못했습니다' }

  revalidatePath('/support/iep')
  return { ok: true }
}
