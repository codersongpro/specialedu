import { tryItNowAdmin, tryItNowTeacher } from './actions'
import { AppBrand } from '@/components/brand'
import { Button } from '@/components/ui'
import { createAdminClient } from '@/lib/supabase/admin'
import { DemoButtons } from './demo-buttons'
import { LoginForm } from './login-form'

export const metadata = { title: '로그인' }

/**
 * 데모 학교가 실제로 들어 있을 때만 둘러보기 버튼을 띄운다.
 * 실제 학교에 배포하면 시드를 돌리지 않으므로 버튼 자체가 나오지 않는다.
 */
async function hasDemoSchool(): Promise<boolean> {
  try {
    const admin = createAdminClient()
    const { data } = await admin.from('schools').select('id').eq('is_demo', true).limit(1)
    return (data?.length ?? 0) > 0
  } catch {
    // 서버 키가 없는 환경에서는 조용히 넘어간다
    return false
  }
}

const NOTICE: Record<string, string> = {
  missing: '데모 데이터가 아직 만들어지지 않았습니다. 관리자에게 문의하세요.',
  blocked: '이 계정은 데모용이 아닙니다. 아래에서 이메일로 로그인하세요.',
}

const REASON_NOTICE: Record<string, string> = {
  timeout:
    '자리를 비운 시간이 길어 자동으로 로그아웃되었습니다. 민감정보 구역일수록 더 짧게 끊깁니다. 다시 로그인해 주세요.',
}

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; demo?: string; reason?: string }>
}) {
  const { next, demo, reason } = await searchParams
  const showDemo = await hasDemoSchool()

  return (
    <main className="flex min-h-dvh items-center justify-center px-6 py-12">
      <div className="w-full max-w-sm">
        <AppBrand size="lg" />
        <p className="mt-3 text-[15px] leading-relaxed text-ink-soft">
          &ldquo;한 아름&rdquo; 가득 안는다는 뜻입니다. 특별실 예약, 결보강,
          학사일정을 한 곳에서 봅니다.
        </p>

        {demo && NOTICE[demo] ? (
          <p className="mt-4 rounded-lg bg-warn-soft px-3 py-2 text-sm text-warn">
            {NOTICE[demo]}
          </p>
        ) : null}

        {reason && REASON_NOTICE[reason] ? (
          <p className="mt-4 rounded-lg bg-warn-soft px-3 py-2 text-sm text-warn">
            {REASON_NOTICE[reason]}
          </p>
        ) : null}

        {showDemo ? (
          <>
            <div className="mt-6 grid grid-cols-2 gap-2">
              <form action={tryItNowAdmin}>
                <Button type="submit" className="w-full">
                  관리자로 체험하기
                </Button>
              </form>
              <form action={tryItNowTeacher}>
                <Button type="submit" variant="secondary" className="w-full">
                  일반 교사로 체험하기
                </Button>
              </form>
            </div>
            <p className="mt-2 text-center text-[13px] text-ink-soft">
              같은 역할군 안에서 계정이 무작위로 배정됩니다. 다른 사람과 동시에
              눌러도 각자 다른 사람으로 들어가 같은 학교 데이터를 실시간으로
              함께 볼 수 있어요. 데이터는 매일 새벽 자동으로 초기화됩니다.
            </p>

            <DemoButtons />
          </>
        ) : null}

        <LoginForm next={next} />

        <p className="mt-6 text-xs leading-relaxed text-ink-soft">
          계정은 학교 관리자가 등록합니다. 직접 가입할 수는 없습니다.
          <br />
          로그인이 안 되면 교무실로 문의하세요.
        </p>

        <p className="mt-3 text-xs">
          <a href="/help" className="text-brand hover:underline">
            사용 설명서 보기
          </a>
        </p>
      </div>
    </main>
  )
}
