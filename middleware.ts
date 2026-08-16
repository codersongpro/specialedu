import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'
import { SESSION_TIMEOUT_MIN, sensitivityForPath } from '@/lib/security/sensitivity'

/**
 * 세션 갱신 + 로그인 확인 + 자리 비움 시간제한.
 *
 * 여기서 supabase.auth.getUser() 를 부르는 것이 중요하다. 만료된 토큰을
 * 갱신해 쿠키에 다시 심어야 서버 컴포넌트가 로그인 상태를 제대로 본다.
 *
 * SESSION_TIMEOUT_MIN(lib/security/sensitivity.ts)이 정의만 돼 있고
 * 실제로 걸리지 않던 걸 여기서 강제한다. 마지막 활동 시각을 서버가
 * 쿠키(httpOnly)로 들고 있다가, 지금 보려는 화면의 민감도 등급에 맞는
 * 제한 시간을 넘겼으면 로그아웃시킨다. 클라이언트 JS로 하면 꺼버리면
 * 그만이라 서버에서 막아야 의미가 있다.
 */
const ACTIVITY_COOKIE = 'ha_activity'

/**
 * 로그인 없이 열 수 있는 경로.
 *
 * /setup 과 /api/demo 는 아직 계정이 하나도 없는 상태에서 써야 하므로 열어 둔다.
 * 시드 경로는 SEED_SECRET 을 따로 확인하므로 여기서 막지 않아도 된다.
 *
 * /logout 도 열어 둔다 — 세션을 끊으러 가는 길목이 세션을 요구하면,
 * 세션이 망가진 사람은 로그아웃조차 못 하고 갇힌다.
 */
const PUBLIC_PATHS = [
  '/login',
  '/logout',
  '/invite',
  '/privacy',
  '/api/calendar',
  '/setup',
  '/api/demo',
  '/help',
]

export async function middleware(request: NextRequest) {
  let response = NextResponse.next({ request })

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  // 환경변수가 없으면 셋업 안내 화면으로 보낸다 (빈 화면보다 낫다)
  if (!url || !anonKey) {
    if (request.nextUrl.pathname === '/setup') return response
    return NextResponse.redirect(new URL('/setup', request.url))
  }

  const supabase = createServerClient(url, anonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll()
      },
      setAll(cookiesToSet) {
        for (const { name, value } of cookiesToSet) {
          request.cookies.set(name, value)
        }
        response = NextResponse.next({ request })
        for (const { name, value, options } of cookiesToSet) {
          response.cookies.set(name, value, options)
        }
      },
    },
  })

  const {
    data: { user },
  } = await supabase.auth.getUser()

  const { pathname } = request.nextUrl
  const isPublic = PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(`${p}/`))

  if (!user && !isPublic) {
    const loginUrl = new URL('/login', request.url)
    // 로그인 후 원래 보려던 화면으로 돌려보낸다
    if (pathname !== '/') loginUrl.searchParams.set('next', pathname)
    return NextResponse.redirect(loginUrl)
  }

  if (user && pathname === '/login') {
    return NextResponse.redirect(new URL('/dashboard', request.url))
  }

  if (user && !isPublic) {
    const timeoutMin = SESSION_TIMEOUT_MIN[sensitivityForPath(pathname)]
    const lastActivity = request.cookies.get(ACTIVITY_COOKIE)?.value
    const now = Date.now()

    if (lastActivity) {
      const elapsedMin = (now - Number(lastActivity)) / 60000
      if (Number.isFinite(elapsedMin) && elapsedMin > timeoutMin) {
        await supabase.auth.signOut()
        const loginUrl = new URL('/login', request.url)
        loginUrl.searchParams.set('reason', 'timeout')
        const timeoutResponse = NextResponse.redirect(loginUrl)
        timeoutResponse.cookies.delete(ACTIVITY_COOKIE)
        return timeoutResponse
      }
    }

    response.cookies.set(ACTIVITY_COOKIE, String(now), {
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      path: '/',
      maxAge: 60 * 60 * 24,
    })
  }

  return response
}

export const config = {
  matcher: [
    /*
     * 정적 파일과 이미지 최적화 요청은 건너뛴다.
     *
     * icon·apple-icon·manifest.webmanifest 는 파일이 아니라 Next.js 가
     * 만들어주는 라우트라 이 목록에 안 넣으면 다른 페이지처럼 로그인
     * 검사에 걸려 리다이렉트된다 — 브라우저·OS 가 로그인 세션 없이도
     * 파비콘·매니페스트를 가져가야 하므로 반드시 열어 둬야 한다.
     */
    '/((?!_next/static|_next/image|favicon.ico|icon|apple-icon|manifest.webmanifest|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
