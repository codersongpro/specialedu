import { createAdminClient } from '@/lib/supabase/admin'

/**
 * 보관기간이 지난 자료 파기.
 *
 * Vercel Cron 이 주 1회 호출한다. 감사로그는 2년, AI 캐시는 7일이 기준이다.
 * 자동으로 지우지 않으면 "안 쓰는데 남아 있는 개인정보"가 계속 쌓인다.
 */
export async function GET(request: Request) {
  // Vercel Cron 은 이 헤더를 붙여 호출한다. 외부에서 못 부르게 막는다.
  const secret = process.env.CRON_SECRET
  if (secret) {
    const auth = request.headers.get('authorization')
    if (auth !== `Bearer ${secret}`) {
      return new Response('Unauthorized', { status: 401 })
    }
  }

  const admin = createAdminClient()

  const [audit, cache] = await Promise.all([
    admin.rpc('purge_expired_audit_logs' as never),
    admin.rpc('purge_expired_ai_cache' as never),
  ])

  return Response.json({
    auditRemoved: audit.data ?? null,
    cacheRemoved: cache.data ?? null,
    at: new Date().toISOString(),
  })
}
