'use server'

import { redirect } from 'next/navigation'
import { z } from 'zod'
import { DEMO_ACCOUNTS, DEMO_PASSWORD } from '@/lib/demo/seed-data'
import { AUDIT_ACTIONS, writeAudit } from '@/lib/security/audit'
import { isPlatformAdminEmail } from '@/lib/security/platform'
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
    // 학교 profiles 행이 없는 계정이라도, 플랫폼 최고관리자 허용목록에
    // 있으면 로그인을 허용한다 — 이 사람은 어느 학교에도 속하지 않는다.
    if (isPlatformAdminEmail(data.user.email)) {
      await writeAudit({
        schoolId: null,
        actorId: data.user.id,
        actorName: data.user.email ?? null,
        action: AUDIT_ACTIONS.platformLogin,
      })
      redirect('/platform')
    }

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

/**
 * 데모 계정으로 바로 들어가기.
 *
 * 비밀번호를 숨기는 기능이 아니다 — 데모 계정과 비밀번호는 README 에 적혀 있다.
 * 역할별로 화면이 어떻게 다른지 눌러서 바로 보라고 만든 버튼이다.
 *
 * 안전장치는 두 겹이다:
 *   - 미리 정해 둔 4개 이메일만 받는다
 *   - 로그인한 뒤 그 계정이 정말 데모 학교 소속인지 확인하고, 아니면 되돌린다
 */
export async function demoLogin(formData: FormData): Promise<void> {
  const email = String(formData.get('email') ?? '')

  if (!DEMO_ACCOUNTS.some((account) => account.email === email)) {
    redirect('/login')
  }

  const supabase = await createClient()
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password: DEMO_PASSWORD,
  })

  if (error || !data.user) {
    redirect('/login?demo=missing')
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('school_id, name')
    .eq('id', data.user.id)
    .maybeSingle()

  const { data: school } = profile
    ? await supabase.from('schools').select('is_demo').eq('id', profile.school_id).maybeSingle()
    : { data: null }

  // 같은 이메일로 실제 계정이 만들어져 있다면 여기서 걸린다
  if (!profile || !school?.is_demo) {
    await supabase.auth.signOut()
    redirect('/login?demo=blocked')
  }

  await writeAudit({
    schoolId: profile.school_id,
    actorId: data.user.id,
    actorName: profile.name,
    action: AUDIT_ACTIONS.login,
    meta: { via: 'demo_button' },
  })

  redirect('/dashboard')
}
