import { logout } from '@/app/login/actions'
import { AppMark } from '@/components/brand'
import { requirePlatformAdmin } from '@/lib/security/platform'

/**
 * 플랫폼 최고관리자 전용 영역.
 *
 * (app) 레이아웃과 완전히 분리돼 있다. 그쪽은 profiles·school_id 가
 * 있는 사람 전용이고, 여기는 반대로 어느 학교에도 속하지 않는 사람 전용이다.
 */
export default async function PlatformLayout({ children }: { children: React.ReactNode }) {
  const admin = await requirePlatformAdmin()

  return (
    <div className="min-h-dvh">
      <header className="sticky top-0 z-10 flex items-center justify-between gap-3 border-b border-line bg-surface px-4 py-3 pt-[max(0.75rem,env(safe-area-inset-top))] sm:px-6">
        <div className="flex min-w-0 items-center gap-2.5">
          <AppMark size={26} />
          <div className="min-w-0">
            <p className="text-sm font-semibold">한아름 · 플랫폼 관리</p>
            <p className="truncate text-xs text-ink-soft">{admin.email}</p>
          </div>
        </div>
        <form action={logout}>
          <button
            type="submit"
            className="shrink-0 text-sm text-ink-soft hover:text-ink"
          >
            로그아웃
          </button>
        </form>
      </header>

      <main className="mx-auto max-w-3xl px-4 py-8 sm:px-6">{children}</main>
    </div>
  )
}
