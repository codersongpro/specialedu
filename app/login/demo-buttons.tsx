import { DEMO_ACCOUNTS } from '@/lib/demo/seed-data'
import { demoLogin } from './actions'

/**
 * 역할별 데모 로그인 버튼.
 *
 * 특수학교 업무는 보는 사람에 따라 화면이 크게 달라진다. 교감이 보는 화면과
 * 시간강사가 보는 화면이 다르다는 걸 설명하는 것보다 눌러 보게 하는 편이 빠르다.
 */
export function DemoButtons() {
  return (
    <div className="mt-8 rounded-xl border border-line bg-surface p-4">
      <p className="text-sm font-semibold">둘러보기</p>
      <p className="mt-1 text-xs leading-relaxed text-ink-soft">
        가상 학교 「한빛특수학교」입니다. 여기 나오는 학생·교직원은 모두 지어낸 인물입니다.
        역할에 따라 보이는 화면이 다르니 눌러서 비교해 보세요.
      </p>

      <div className="mt-3 grid gap-1.5 sm:grid-cols-2">
        {DEMO_ACCOUNTS.map((account) => (
          <form key={account.email} action={demoLogin}>
            <input type="hidden" name="email" value={account.email} />
            <button
              type="submit"
              className="w-full rounded-lg border border-line px-3 py-2 text-left transition-colors hover:border-brand hover:bg-brand-soft"
            >
              <span className="block text-sm font-medium">{account.note}</span>
              <span className="block text-[11px] text-ink-soft">{account.name}</span>
            </button>
          </form>
        ))}
      </div>
    </div>
  )
}
