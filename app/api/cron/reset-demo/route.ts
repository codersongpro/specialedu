import { seedDemoSchool } from '@/lib/demo/seed'
import { createAdminClient } from '@/lib/supabase/admin'

/**
 * 데모 학교를 매일 새벽 지우고 다시 만든다.
 *
 * "체험하기"로 여러 사람이 드나들며 예약을 지우거나 결보강을 뒤섞어 놓아도
 * 다음날이면 깨끗해진다. seedDemoSchool 자체가 "기존 데모 학교를 지우고
 * 새로 만드는" 함수라 이 라우트는 그걸 부르기만 하면 된다 — is_demo=true
 * 인 행만 건드리므로 실제 학교 데이터와는 어떤 경로로도 섞이지 않는다.
 *
 * 데모 학교를 아예 만든 적이 없는 배포(실제 학교만 운영 중)에서는 조용히
 * 건너뛴다. 아무도 원하지 않았는데 갑자기 데모 학교가 생기면 안 된다.
 */

export const maxDuration = 300

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET
  if (secret) {
    const auth = request.headers.get('authorization')
    if (auth !== `Bearer ${secret}`) {
      return new Response('Unauthorized', { status: 401 })
    }
  }

  const admin = createAdminClient()

  const { data: existing } = await admin
    .from('schools')
    .select('id')
    .eq('is_demo', true)
    .limit(1)

  if (!existing || existing.length === 0) {
    return Response.json({ skipped: true, reason: '데모 학교가 없어 건너뜀' })
  }

  const lines: string[] = []
  try {
    const summary = await seedDemoSchool(admin, (message) => lines.push(message))
    return Response.json({ ok: true, summary, at: new Date().toISOString() })
  } catch (error) {
    console.error('[cron/reset-demo] 실패', error)
    return Response.json(
      {
        error: '데모 초기화에 실패했습니다',
        detail: error instanceof Error ? error.message : String(error),
        log: lines,
      },
      { status: 500 },
    )
  }
}
