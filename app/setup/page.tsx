import { SeedPanel } from './seed-panel'

/**
 * 셋업 안내.
 *
 * 환경변수가 없으면 미들웨어가 여기로 보낸다. 빈 화면이나 스택트레이스 대신
 * 다음에 뭘 해야 하는지 알려 준다. 설정을 마친 뒤에도 직접 열 수 있고,
 * 아래에서 데모 데이터를 만들 수 있다.
 */
export default function SetupPage() {
  const steps = [
    {
      title: 'Supabase 프로젝트 만들기',
      body: 'supabase.com 에서 새 프로젝트를 만듭니다. 리전은 Northeast Asia (Seoul) 을 고르세요. 무료로 시작할 수 있습니다.',
    },
    {
      title: '스키마 올리기',
      body: 'Supabase 대시보드 > SQL Editor 를 열고, 저장소의 supabase/schema.sql 을 통째로 붙여넣어 실행합니다. 표 23개와 접근 권한 정책이 한 번에 만들어집니다.',
    },
    {
      title: '환경변수 넣기',
      body: 'Vercel 프로젝트 설정 > Environment Variables 에 아래 네 가지를 넣고 다시 배포합니다. service_role 키에는 NEXT_PUBLIC_ 을 붙이면 안 됩니다.',
      vars: [
        ['NEXT_PUBLIC_SUPABASE_URL', 'Supabase > 프로젝트 설정 > API 의 Project URL'],
        ['NEXT_PUBLIC_SUPABASE_ANON_KEY', '같은 화면의 anon public 키'],
        ['SUPABASE_SERVICE_ROLE_KEY', '같은 화면의 service_role 키'],
        ['GEMINI_KEY_ENCRYPTION_KEY', 'openssl rand -base64 32 로 만든 값'],
      ],
    },
  ]

  return (
    <main className="mx-auto max-w-2xl px-6 py-16">
      <h1 className="text-2xl font-semibold">셋업</h1>
      <p className="mt-2 text-[15px] text-ink-soft">
        데이터베이스 연결 정보가 없으면 앱을 띄울 수 없습니다. 아래 순서대로 하면 됩니다.
      </p>

      <ol className="mt-8 space-y-6">
        {steps.map((step, index) => (
          <li key={step.title} className="flex gap-4">
            <span className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-full bg-brand-soft text-sm font-semibold text-brand">
              {index + 1}
            </span>
            <div className="min-w-0">
              <p className="font-medium">{step.title}</p>
              <p className="mt-1 text-sm leading-relaxed text-ink-soft">{step.body}</p>

              {step.vars ? (
                <dl className="mt-3 space-y-1.5 rounded-lg bg-canvas p-3">
                  {step.vars.map(([name, where]) => (
                    <div key={name}>
                      <dt className="break-all font-mono text-xs">{name}</dt>
                      <dd className="text-xs text-ink-soft">{where}</dd>
                    </div>
                  ))}
                </dl>
              ) : null}
            </div>
          </li>
        ))}
      </ol>

      <SeedPanel />

      <p className="mt-8 text-sm text-ink-soft">
        더 자세한 내용은 저장소의 README.md 에 적어 두었습니다.
      </p>
    </main>
  )
}
