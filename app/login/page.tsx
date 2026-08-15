import { AppBrand } from '@/components/brand'
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

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; demo?: string }>
}) {
  const { next, demo } = await searchParams
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

        {showDemo ? <DemoButtons /> : null}

        <LoginForm next={next} />

        <p className="mt-6 text-xs leading-relaxed text-ink-soft">
          계정은 학교 관리자가 등록합니다. 직접 가입할 수는 없습니다.
          <br />
          로그인이 안 되면 교무실로 문의하세요.
        </p>
      </div>
    </main>
  )
}
