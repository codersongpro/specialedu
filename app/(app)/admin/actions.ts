'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { createInviteToken, inviteExpiryFrom } from '@/lib/security/invite'
import { encryptSecret, keyHint } from '@/lib/security/crypto'
import { createAdminClient } from '@/lib/supabase/admin'
import { createClient, isAdmin, requireSession } from '@/lib/supabase/server'
import { DEFAULT_WEIGHTS } from '@/lib/substitution/score'

const InviteInput = z.object({
  email: z.string().email('이메일 형식이 아닙니다'),
  name: z.string().min(1, '이름을 적어 주세요').max(40),
  role: z.enum(['admin', 'manager', 'teacher', 'part_time', 'staff']),
  employment: z.enum(['full_time', 'fixed_term', 'part_time', 'assistant']),
})

export interface InviteState {
  error?: string
  /** 메일 발송이 붙기 전까지는 관리자가 이 링크를 직접 전달한다 */
  link?: string
}

export async function createInvitation(
  _prev: InviteState,
  formData: FormData,
): Promise<InviteState> {
  const session = await requireSession()
  if (!isAdmin(session.profile)) return { error: '권한이 없습니다' }

  const parsed = InviteInput.safeParse({
    email: formData.get('email'),
    name: formData.get('name'),
    role: formData.get('role'),
    employment: formData.get('employment'),
  })
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? '입력을 확인하세요' }
  }

  const supabase = await createClient()
  const { token, hash } = createInviteToken()

  const { error } = await supabase.from('invitations').insert({
    school_id: session.school.id,
    email: parsed.data.email.toLowerCase(),
    name: parsed.data.name,
    role: parsed.data.role,
    employment: parsed.data.employment,
    token_hash: hash,
    expires_at: inviteExpiryFrom().toISOString(),
    invited_by: session.userId,
  })

  if (error) return { error: '만들지 못했습니다. 이미 초대한 이메일인지 확인하세요.' }

  revalidatePath('/admin')
  return { link: `/invite/${token}` }
}

export async function revokeInvitation(formData: FormData): Promise<void> {
  const session = await requireSession()
  if (!isAdmin(session.profile)) return

  const id = String(formData.get('id') ?? '')
  if (!id) return

  const supabase = await createClient()
  await supabase.from('invitations').delete().eq('id', id)
  revalidatePath('/admin')
}

const WeightsInput = z.object({
  partTimeFirst: z.coerce.number().int().min(-100).max(100),
  sameSubject: z.coerce.number().int().min(-100).max(100),
  sameCourseGrade: z.coerce.number().int().min(-100).max(100),
  homeroomOfClass: z.coerce.number().int().min(-100).max(100),
  fairnessMax: z.coerce.number().int().min(-100).max(100),
  longRunPenalty: z.coerce.number().int().min(-100).max(100),
  sameFloorBonus: z.coerce.number().int().min(-100).max(100),
  longRunThreshold: z.coerce.number().int().min(2).max(10),
})

export interface WeightsState {
  error?: string
  ok?: boolean
}

export async function saveWeights(
  _prev: WeightsState,
  formData: FormData,
): Promise<WeightsState> {
  const session = await requireSession()
  if (!isAdmin(session.profile)) return { error: '권한이 없습니다' }

  const parsed = WeightsInput.safeParse(Object.fromEntries(formData))
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? '숫자를 확인하세요' }
  }

  const { longRunThreshold, ...weights } = parsed.data

  const supabase = await createClient()
  const { error } = await supabase.from('substitution_rules').upsert({
    school_id: session.school.id,
    weights: { ...DEFAULT_WEIGHTS, ...weights },
    long_run_threshold: longRunThreshold,
    updated_by: session.userId,
    updated_at: new Date().toISOString(),
  })

  if (error) return { error: '저장하지 못했습니다' }

  revalidatePath('/admin')
  return { ok: true }
}

export async function toggleFreeTextAi(formData: FormData): Promise<void> {
  const session = await requireSession()
  if (!isAdmin(session.profile)) return

  const enable = formData.get('enable') === '1'
  const supabase = await createClient()
  await supabase
    .from('schools')
    .update({ allow_free_text_ai: enable })
    .eq('id', session.school.id)

  revalidatePath('/admin')
}

const SchoolKeyInput = z.object({ apiKey: z.string().min(20).max(200) })

export async function saveSchoolKey(
  _prev: WeightsState,
  formData: FormData,
): Promise<WeightsState> {
  const session = await requireSession()
  if (!isAdmin(session.profile)) return { error: '권한이 없습니다' }

  const parsed = SchoolKeyInput.safeParse({ apiKey: formData.get('apiKey') })
  if (!parsed.success) return { error: '키를 확인하세요' }

  const apiKey = parsed.data.apiKey.trim()

  // 학교 공용 키는 RLS 상 관리자만 수정할 수 있지만,
  // 키 컬럼은 일반 교직원에게도 조회되므로 암호문만 저장한다.
  const admin = createAdminClient()
  const { error } = await admin
    .from('schools')
    .update({ gemini_key_enc: encryptSecret(apiKey), gemini_key_hint: keyHint(apiKey) })
    .eq('id', session.school.id)

  if (error) return { error: '저장하지 못했습니다' }

  revalidatePath('/admin')
  return { ok: true }
}
