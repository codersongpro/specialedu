import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

/**
 * 세션을 확실히 끊고 로그인 화면으로 보낸다.
 *
 * 왜 서버 액션(app/login/actions.ts의 logout)이 아니라 라우트 핸들러가
 * 따로 필요한가: (app) 레이아웃처럼 **서버 컴포넌트**에서는 쿠키를 쓸 수
 * 없다(lib/supabase/server.ts의 setAll이 그 예외를 삼킨다). 그래서 거기서
 * signOut()을 불러도 쿠키가 안 지워진다. 라우트 핸들러는 쿠키를 쓸 수
 * 있으므로, 레이아웃은 여기로 리다이렉트만 하고 실제 정리는 여기서 한다.
 *
 * 이게 없으면 "auth 계정은 살아 있는데 profiles 행이 없는" 사람이 무한
 * 리다이렉트에 갇힌다 — 미들웨어는 로그인된 걸로 보고 /login → /dashboard
 * 로 보내고, (app) 레이아웃은 프로필이 없으니 /dashboard → /login 으로
 * 되돌린다. 실제로 운영 DB의 profiles가 통째로 지워졌을 때 이 증상이
 * 났고, 브라우저 쿠키를 손으로 지우기 전에는 로그아웃조차 할 수 없었다.
 */
export async function GET(request: Request) {
  const supabase = await createClient()
  try {
    await supabase.auth.signOut()
  } catch {
    // 네트워크 오류 등으로 실패해도 아래에서 쿠키를 직접 만료시킨다.
    // 여기서 500을 내면 사용자는 갇힌 상태 그대로 남는다 — 그게 제일 나쁘다.
  }

  const url = new URL('/login', request.url)
  url.searchParams.set('reason', 'stale')
  const response = NextResponse.redirect(url, 303)

  // signOut() 이 쿠키를 못 지웠을 경우를 대비한 안전장치.
  const cookieStore = await cookies()
  for (const cookie of cookieStore.getAll()) {
    if (cookie.name.startsWith('sb-')) response.cookies.delete(cookie.name)
  }
  response.cookies.delete('ha_activity')

  return response
}
