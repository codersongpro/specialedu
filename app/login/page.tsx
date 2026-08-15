import { LoginForm } from './login-form'

export const metadata = { title: '로그인 · 특수학교 업무 지원' }

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>
}) {
  const { next } = await searchParams

  return (
    <main className="flex min-h-screen items-center justify-center px-6 py-12">
      <div className="w-full max-w-sm">
        <h1 className="text-xl font-semibold">특수학교 업무 지원</h1>
        <p className="mt-1.5 text-sm text-ink-soft">
          특별실 예약, 결보강, 학사일정을 한 곳에서 봅니다.
        </p>

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
