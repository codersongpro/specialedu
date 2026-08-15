/**
 * 환경변수가 없을 때 보여주는 화면.
 * 빈 화면이나 스택트레이스 대신 다음에 뭘 해야 하는지 알려준다.
 */
export default function SetupPage() {
  const steps = [
    {
      title: 'Supabase 프로젝트 만들기',
      body: 'supabase.com 에서 새 프로젝트를 만듭니다. 리전은 Northeast Asia (Seoul) 을 고르세요.',
    },
    {
      title: '.env.local 채우기',
      body: '저장소의 .env.example 을 .env.local 로 복사하고, Supabase 프로젝트 설정 > API 에서 URL 과 키를 가져와 넣습니다.',
    },
    {
      title: '스키마 올리기',
      body: 'supabase db push 로 supabase/migrations 의 SQL 을 적용합니다.',
    },
    {
      title: '데모 데이터 넣기',
      body: 'npm run seed:demo 를 실행하면 가상 학교와 테스트 계정 4개가 만들어집니다.',
    },
  ]

  return (
    <main className="mx-auto flex min-h-screen max-w-2xl flex-col justify-center px-6 py-16">
      <h1 className="text-2xl font-semibold">아직 설정이 안 끝났습니다</h1>
      <p className="mt-2 text-[15px] text-ink-soft">
        데이터베이스 연결 정보가 없어서 앱을 띄울 수 없습니다. 아래 순서대로 하면 됩니다.
      </p>

      <ol className="mt-8 space-y-5">
        {steps.map((step, index) => (
          <li key={step.title} className="flex gap-4">
            <span className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-full bg-brand-soft text-sm font-semibold text-brand">
              {index + 1}
            </span>
            <div>
              <p className="font-medium">{step.title}</p>
              <p className="mt-1 text-sm text-ink-soft">{step.body}</p>
            </div>
          </li>
        ))}
      </ol>

      <p className="mt-10 rounded-lg border border-line bg-surface p-4 text-sm text-ink-soft">
        자세한 내용은 저장소의 README.md 에 적어 두었습니다.
      </p>
    </main>
  )
}
