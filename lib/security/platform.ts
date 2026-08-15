import 'server-only'

import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

/**
 * 플랫폼 최고관리자.
 *
 * 학교 admin(교감·부장)과는 완전히 다른 개념이다. 학교 admin은 profiles
 * 행이 있고 school_id 로 RLS 가 걸린다. 최고관리자는 **어느 학교에도
 * 속하지 않는다** — 새 학교를 여는 사람이라 소속 학교 자체가 없다.
 *
 * 그래서 DB 역할이 아니라 이메일 허용목록(PLATFORM_ADMIN_EMAILS)으로
 * 판단한다. Supabase Auth 계정만 있으면 되고 profiles 행은 필요 없다.
 */

function allowedEmails(): string[] {
  return (process.env.PLATFORM_ADMIN_EMAILS ?? '')
    .split(',')
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean)
}

export function isPlatformAdminEmail(email: string | null | undefined): boolean {
  if (!email) return false
  return allowedEmails().includes(email.toLowerCase())
}

export interface PlatformAdmin {
  id: string
  email: string
}

/** 플랫폼 화면에서만 쓴다. 로그인 안 됐으면 로그인으로, 권한 없으면 대시보드로 보낸다. */
export async function requirePlatformAdmin(): Promise<PlatformAdmin> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect('/login')
  if (!isPlatformAdminEmail(user.email)) redirect('/dashboard')

  return { id: user.id, email: user.email! }
}
