'use server'

import { redirect } from 'next/navigation'
import { z } from 'zod'
import { AUDIT_ACTIONS, writeAudit } from '@/lib/security/audit'
import { createClient } from '@/lib/supabase/server'

const LoginInput = z.object({
  email: z.string().email('이메일 형식이 아닙니다'),
  password: z.string().min(1, '비밀번호를 입력하세요'),
  next: z.string().optional(),
})

export interface LoginState {
  error?: string
}

export async function login(_prev: LoginState, formData: FormData): Promise<LoginState> {
  const parsed = LoginInput.safeParse({
    email: formData.get('email'),
    password: formData.get('password'),
    next: formData.get('next') || undefined,
  })

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? '입력을 확인하세요' }
  }

  const supabase = await createClient()
  const { data, error } = await supabase.auth.signInWithPassword({
    email: parsed.data.email,
    password: parsed.data.password,
  })

  if (error || !data.user) {
    // 어떤 계정이 존재하는지 알려주지 않는다. 계정 열거 공격을 막는다.
    return { error: '이메일 또는 비밀번호가 맞지 않습니다' }
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('school_id, name, is_active')
    .eq('id', data.user.id)
    .maybeSingle()

  if (!profile || !profile.is_active) {
    await supabase.auth.signOut()
    return { error: '사용할 수 없는 계정입니다. 관리자에게 문의하세요.' }
  }

  await writeAudit({
    schoolId: profile.school_id,
    actorId: data.user.id,
    actorName: profile.name,
    action: AUDIT_ACTIONS.login,
  })

  // 열린 리다이렉트를 막으려고 앱 내부 경로만 허용한다
  const next = parsed.data.next
  const safeNext = next && next.startsWith('/') && !next.startsWith('//') ? next : '/dashboard'
  redirect(safeNext)
}

export async function logout() {
  const supabase = await createClient()
  await supabase.auth.signOut()
  redirect('/login')
}
