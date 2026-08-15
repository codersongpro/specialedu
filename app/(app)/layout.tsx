import { redirect } from 'next/navigation'
import { logout } from '@/app/login/actions'
import { AppNav } from '@/components/app-nav'
import { ZoneGuard } from '@/components/zone-guard'
import { getSessionContext, isAdmin } from '@/lib/supabase/server'
import { visibleNav } from '@/lib/security/sensitivity'

const ROLE_LABEL: Record<string, string> = {
  admin: '관리자',
  manager: '부장',
  teacher: '교사',
  part_time: '시간강사',
  staff: '실무사',
}

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await getSessionContext()
  if (!session) redirect('/login')

  const { profile, school } = session
  const nav = visibleNav(isAdmin(profile))

  return (
    <div className="min-h-screen lg:grid lg:grid-cols-[240px_1fr]">
      <aside className="border-line bg-surface lg:sticky lg:top-0 lg:h-screen lg:overflow-y-auto lg:border-r">
        <div className="flex items-center justify-between gap-2 border-b border-line px-4 py-3.5 lg:block lg:border-b-0">
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold">{school.name}</p>
            <p className="mt-0.5 truncate text-xs text-ink-soft">
              {profile.name} {ROLE_LABEL[profile.role] ?? ''}
            </p>
          </div>
        </div>

        <AppNav categories={nav} />

        <form action={logout} className="border-t border-line p-3">
          <button
            type="submit"
            className="w-full rounded-lg px-2.5 py-2 text-left text-sm text-ink-soft hover:bg-canvas"
          >
            로그아웃
          </button>
        </form>
      </aside>

      <div className="flex min-w-0 flex-col">
        {school.is_demo ? (
          <p className="no-print bg-warn-soft px-4 py-2 text-center text-xs text-warn">
            데모 데이터입니다. 여기 있는 학생·교직원은 모두 가상 인물입니다.
          </p>
        ) : null}

        <ZoneGuard schoolId={school.id} />

        <main className="mx-auto w-full max-w-[1400px] flex-1 px-4 py-6 lg:px-8">{children}</main>
      </div>
    </div>
  )
}
