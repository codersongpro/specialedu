'use server'

import { redirect } from 'next/navigation'
import { z } from 'zod'
import { AUDIT_ACTIONS, writeAudit } from '@/lib/security/audit'
import { hashInviteToken } from '@/lib/security/invite'
import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'

const AcceptInput = z
  .object({
    token: z.string().min(10),
    password: z.string().min(10, '비밀번호는 10자 이상으로 정하세요'),
    confirm: z.string(),
  })
  .refine((v) => v.password === v.confirm, {
    message: '두 비밀번호가 다릅니다',
    path: ['confirm'],
  })

export interface AcceptState {
  error?: string
}

/**
 * 초대 수락.
 *
 * 아직 프로필이 없어 RLS 를 통과할 수 없으므로 service role 로 처리한다.
 * 대신 토큰 검증을 여기서 엄격하게 한다 — 만료·재사용을 모두 막는다.
 */
export async function acceptInvite(
  _prev: AcceptState,
  formData: FormData,
): Promise<AcceptState> {
  const parsed = AcceptInput.safeParse({
    token: formData.get('token'),
    password: formData.get('password'),
    confirm: formData.get('confirm'),
  })

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? '입력을 확인하세요' }
  }

  const admin = createAdminClient()
  const tokenHash = hashInviteToken(parsed.data.token)

  const { data: invitation } = await admin
    .from('invitations')
    .select('*')
    .eq('token_hash', tokenHash)
    .maybeSingle()

  if (!invitation) {
    return { error: '유효하지 않은 초대 링크입니다' }
  }
  if (invitation.accepted_at) {
    return { error: '이미 사용한 초대 링크입니다. 로그인 화면에서 로그인하세요.' }
  }
  if (new Date(invitation.expires_at) < new Date()) {
    return { error: '초대 링크가 만료됐습니다. 관리자에게 다시 요청하세요.' }
  }

  const { data: created, error: createError } = await admin.auth.admin.createUser({
    email: invitation.email,
    password: parsed.data.password,
    email_confirm: true,
  })

  if (createError || !created.user) {
    return { error: '계정을 만들지 못했습니다. 관리자에게 문의하세요.' }
  }

  const { error: profileError } = await admin.from('profiles').insert({
    id: created.user.id,
    school_id: invitation.school_id,
    name: invitation.name,
    role: invitation.role,
    employment: invitation.employment,
    department_id: invitation.department_id,
  })

  if (profileError) {
    // 프로필이 없으면 로그인해도 아무것도 못 한다. 계정을 되돌린다.
    await admin.auth.admin.deleteUser(created.user.id)
    return { error: '계정을 만들지 못했습니다. 관리자에게 문의하세요.' }
  }

  await admin
    .from('invitations')
    .update({ accepted_at: new Date().toISOString() })
    .eq('id', invitation.id)

  await writeAudit({
    schoolId: invitation.school_id,
    actorId: created.user.id,
    actorName: invitation.name,
    action: AUDIT_ACTIONS.inviteAccept,
    targetTable: 'invitations',
    targetId: invitation.id,
  })

  const supabase = await createClient()
  await supabase.auth.signInWithPassword({
    email: invitation.email,
    password: parsed.data.password,
  })

  redirect('/dashboard')
}
