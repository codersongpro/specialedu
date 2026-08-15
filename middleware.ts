import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

/**
 * 세션 갱신 + 로그인 확인.
 *
 * 여기서 supabase.auth.getUser() 를 부르는 것이 중요하다. 만료된 토큰을
 * 갱신해 쿠키에 다시 심어야 서버 컴포넌트가 로그인 상태를 제대로 본다.
 */

const PUBLIC_PATHS = ['/login', '/invite', '/privacy', '/api/calendar']

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

  return response
}

export const config = {
  matcher: [
    /*
     * 정적 파일과 이미지 최적화 요청은 건너뛴다.
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
