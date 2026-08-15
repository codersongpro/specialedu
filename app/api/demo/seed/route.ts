import { seedDemoSchool } from '@/lib/demo/seed'
import { createAdminClient } from '@/lib/supabase/admin'

/**
 * 배포된 사이트에서 데모 데이터 만들기.
 *
 *   curl -X POST https://<주소>/api/demo/seed -H "Authorization: Bearer <SEED_SECRET>"
 *
 * 로컬에 node 나 supabase CLI 를 깔지 않고도 데모를 띄울 수 있게 열어 둔 길이다.
 * 대신 두 가지를 건다:
 *   - SEED_SECRET 환경변수가 없으면 아예 동작하지 않는다 (기본은 잠김)
 *   - 실제 학교 데이터가 이미 있으면 거부한다
 *
 * 두 번째가 중요하다. 이 함수는 기존 데모 학교를 지우고 다시 만드는데,
 * 운영 중인 학교에서 실수로 부르면 안 된다.
 */

// 시드는 오래 걸린다 (계정 25개 생성 + 여러 번의 삽입)
export const maxDuration = 300

export async function POST(request: Request) {
  const secret = process.env.SEED_SECRET

  if (!secret) {
    return Response.json(
      { error: 'SEED_SECRET 이 설정돼 있지 않습니다. 환경변수를 넣고 다시 배포하세요.' },
      { status: 404 },
    )
  }

  if (request.headers.get('authorization') !== `Bearer ${secret}`) {
    return Response.json({ error: '인증 실패' }, { status: 401 })
  }

  const admin = createAdminClient()

  // 실제 학교가 하나라도 있으면 멈춘다
  const { data: realSchools } = await admin
    .from('schools')
    .select('id, name')
    .eq('is_demo', false)
    .limit(1)

  if (realSchools && realSchools.length > 0) {
    return Response.json(
      {
        error: `실제 학교(${realSchools[0]!.name})가 등록돼 있어 데모 시드를 돌리지 않습니다.`,
        hint: '데모는 별도 프로젝트에서 띄우세요.',
      },
      { status: 409 },
    )
  }

  const lines: string[] = []

  try {
    const summary = await seedDemoSchool(admin, (message) => lines.push(message))
    return Response.json({ ok: true, summary, log: lines })
  } catch (error) {
    console.error('[demo/seed] 실패', error)
    return Response.json(
      {
        error: '시드에 실패했습니다. 스키마(마이그레이션)를 먼저 적용했는지 확인하세요.',
        detail: describeError(error),
        log: lines,
      },
      { status: 500 },
    )
  }
}

/**
 * Supabase 가 던지는 에러(PostgrestError, AuthError 등)는 message 외에
 * details·hint·code 가 따로 붙어 있는 경우가 많고, 드물게 Error 인스턴스가
 * 아닌 평범한 객체로 넘어올 때도 있다. error.message 하나만 보면 원인이
 * 안 보이거나 "[object Object]" 로 뭉개질 수 있어 가진 정보를 다 모은다.
 */
function describeError(error: unknown): string {
  if (error instanceof Error && error.message) {
    return error.message
  }
  if (error && typeof error === 'object') {
    const record = error as Record<string, unknown>
    const parts = ['message', 'details', 'hint', 'code']
      .map((key) => (record[key] ? `${key}: ${String(record[key])}` : null))
      .filter((part): part is string => part != null)
    if (parts.length > 0) return parts.join(' · ')
    try {
      return JSON.stringify(error)
    } catch {
      // JSON.stringify 도 실패하는 순환 참조 같은 드문 경우
    }
  }
  return String(error)
}
