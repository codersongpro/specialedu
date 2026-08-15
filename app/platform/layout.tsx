import { logout } from '@/app/login/actions'
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
    <div className="min-h-screen">
      <header className="flex items-center justify-between border-b border-line bg-surface px-6 py-3.5">
        <div>
          <p className="text-sm font-semibold">플랫폼 관리</p>
          <p className="text-xs text-ink-soft">{admin.email}</p>
        </div>
        <form action={logout}>
          <button type="submit" className="text-sm text-ink-soft hover:text-ink">
            로그아웃
          </button>
        </form>
      </header>

      <main className="mx-auto max-w-3xl px-6 py-8">{children}</main>
    </div>
  )
}
