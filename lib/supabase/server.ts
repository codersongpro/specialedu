import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { cache } from 'react'
import type { Database, ProfileRow, SchoolRow } from './database.types'

/**
 * 서버 컴포넌트·서버 액션용 클라이언트.
 *
 * 사용자 JWT 로 질의하므로 RLS 가 그대로 걸린다.
 * 관리자 권한이 필요한 작업은 admin.ts 의 클라이언트를 쓴다.
 */
export async function createClient() {
  const cookieStore = await cookies()

  return createServerClient<Database>(
    requireEnv('NEXT_PUBLIC_SUPABASE_URL'),
    requireEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY'),
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          try {
            for (const { name, value, options } of cookiesToSet) {
              cookieStore.set(name, value, options)
            }
          } catch {
            // 서버 컴포넌트에서는 쿠키를 쓸 수 없다. 미들웨어가 갱신을 맡는다.
          }
        },
      },
    },
  )
}

/**
 * 팩토리에서 타입을 끌어온다.
 * SupabaseClient 의 제네릭 자리수가 버전마다 달라 손으로 쓰면 어긋난다.
 */
export type TypedClient = Awaited<ReturnType<typeof createClient>>

export interface SessionContext {
  userId: string
  profile: ProfileRow
  school: SchoolRow
}

/**
 * 로그인한 교직원의 프로필과 학교.
 *
 * 한 요청 안에서 여러 번 불려도 한 번만 조회하도록 cache 로 감쌌다.
 */
export const getSessionContext = cache(async (): Promise<SessionContext | null> => {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return null

  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .maybeSingle()

  if (!profile || !profile.is_active) return null

  const { data: school } = await supabase
    .from('schools')
    .select('*')
    .eq('id', profile.school_id)
    .maybeSingle()

  if (!school) return null

  return { userId: user.id, profile, school }
})

/** 로그인이 필요한 화면에서 쓴다. 없으면 예외를 던져 레이아웃이 로그인으로 보낸다. */
export async function requireSession(): Promise<SessionContext> {
  const session = await getSessionContext()
  if (!session) throw new Error('UNAUTHENTICATED')
  return session
}

export function isAdmin(profile: ProfileRow): boolean {
  return profile.role === 'admin' || profile.role === 'manager'
}

function requireEnv(name: string): string {
  const value = process.env[name]
  if (!value) {
    throw new Error(
      `환경변수 ${name} 가 없습니다. .env.local 을 만들고 README 의 셋업 절차를 따르세요.`,
    )
  }
  return value
}
