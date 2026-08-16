'use client'

import { useEffect, useState } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import {
  getMyNotifications,
  markAllNotificationsRead,
  markNotificationRead,
  type NotificationItem,
} from '@/app/actions/notifications'
import { logout } from '@/app/login/actions'
import { AppNav } from '@/components/app-nav'
import { AppMark } from '@/components/brand'
import { NotificationBell } from '@/components/notification-bell'
import { ZoneGuard } from '@/components/zone-guard'
import { createClient } from '@/lib/supabase/client'
import type { NavCategory } from '@/lib/security/sensitivity'

interface Props {
  nav: NavCategory[]
  schoolId: string
  schoolName: string
  isDemo: boolean
  profileId: string
  profileName: string
  roleLabel: string
  children: React.ReactNode
}

/**
 * 로그인 뒤 화면 전체 뼈대.
 *
 * 데스크톱(lg 이상)에서는 고정 사이드바 — 예전과 완전히 같은 모습이다.
 * 그보다 좁으면 사이드바가 사라지고 대신 위쪽에 얇은 바(학교 이름 + 메뉴
 * 버튼)만 남는다. 메뉴 버튼을 누르면 같은 내용(로고·학교·메뉴·로그아웃)이
 * 전체 화면 시트로 뜬다 — 화면이 좁아졌다고 기능이 잘려 보이는 게 아니라,
 * 앱을 처음부터 휴대폰에 맞춰 만든 것처럼 느껴지게 하려는 것이다.
 */
export function AppShell({
  nav,
  schoolId,
  schoolName,
  isDemo,
  profileId,
  profileName,
  roleLabel,
  children,
}: Props) {
  const [open, setOpen] = useState(false)
  const pathname = usePathname()
  const router = useRouter()

  // 다른 화면으로 옮기면 열려 있던 메뉴는 저절로 닫는다
  useEffect(() => {
    setOpen(false)
  }, [pathname])

  // 알림 목록 + Realtime 구독은 여기서 딱 한 번만 한다. 벨 아이콘은
  // 데스크톱 사이드바·모바일 상단바 두 곳에 동시에 떠 있는데, 각자
  // 따로 구독하면 같은 채널 토픽을 두 번 subscribe() 하게 돼 오류가
  // 난다(components/notification-bell.tsx 주석 참고).
  const [notifications, setNotifications] = useState<NotificationItem[]>([])

  useEffect(() => {
    getMyNotifications().then(setNotifications)
  }, [])

  useEffect(() => {
    const supabase = createClient()
    const channel = supabase.channel(`notifications:${profileId}`)
    channel.on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'notifications', filter: `profile_id=eq.${profileId}` },
      () => {
        getMyNotifications().then(setNotifications)
      },
    )
    channel.subscribe()
    return () => void supabase.removeChannel(channel)
  }, [profileId])

  async function openNotification(item: NotificationItem) {
    if (!item.readAt) {
      setNotifications((prev) =>
        prev.map((n) => (n.id === item.id ? { ...n, readAt: new Date().toISOString() } : n)),
      )
      await markNotificationRead(item.id)
    }
    if (item.link) router.push(item.link)
  }

  async function markAllNotifications() {
    setNotifications((prev) => prev.map((n) => ({ ...n, readAt: n.readAt ?? new Date().toISOString() })))
    await markAllNotificationsRead()
  }

  // 메뉴가 열려 있는 동안은 뒤 배경이 스크롤되지 않는다 — 네이티브 앱의
  // 바텀시트/모달과 같은 느낌을 준다
  useEffect(() => {
    if (!open) return
    const original = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = original
    }
  }, [open])

  useEffect(() => {
    if (!open) return
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') setOpen(false)
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [open])

  // 브랜드+학교 블록과 메뉴 본문을 나눠 둔다. 데스크톱 사이드바에는 둘 다,
  // 모바일 전체화면 시트에는 자체 상단바가 따로 있어 본문만 쓴다 —
  // 안 그러면 "한아름"이 시트 안에 두 번 보인다.
  const brandBlock = (
    <div className="flex items-center gap-2.5 border-b border-line px-4 py-4">
      <AppMark size={26} />
      <div className="min-w-0">
        <p className="text-[13px] font-semibold text-ink-soft">한아름</p>
        <p className="truncate text-[17px] font-semibold">{schoolName}</p>
      </div>
    </div>
  )

  const bodyBlock = (
    <>
      <div className="flex items-center justify-between gap-2 border-b border-line px-4 py-2.5">
        <p className="min-w-0 truncate text-[15px] text-ink-soft">
          {profileName} {roleLabel}
        </p>
        <NotificationBell
          items={notifications}
          onOpenItem={openNotification}
          onMarkAll={markAllNotifications}
        />
      </div>

      <AppNav categories={nav} />

      <form action={logout} className="mt-auto border-t border-line p-3">
        <button
          type="submit"
          className="w-full rounded-lg px-2.5 py-2.5 text-left text-[15px] text-ink-soft hover:bg-canvas"
        >
          로그아웃
        </button>
      </form>
    </>
  )

  return (
    <div className="min-h-dvh lg:grid lg:grid-cols-[252px_1fr]">
      {/* 데스크톱 고정 사이드바. 모바일 메뉴 상태와는 무관하게 항상 이 모습 그대로다. */}
      <aside className="hidden border-line bg-surface lg:sticky lg:top-0 lg:flex lg:h-dvh lg:flex-col lg:overflow-y-auto lg:border-r">
        {brandBlock}
        {bodyBlock}
      </aside>

      {/* 모바일 전용 상단 바 */}
      <header className="sticky top-0 z-30 flex items-center justify-between gap-3 border-b border-line bg-surface px-4 py-2.5 pt-[max(0.625rem,env(safe-area-inset-top))] lg:hidden">
        <div className="flex min-w-0 items-center gap-2">
          <AppMark size={24} />
          <p className="truncate text-[16.5px] font-semibold leading-tight">{schoolName}</p>
        </div>
        <div className="flex shrink-0 items-center gap-1.5">
          <NotificationBell
            items={notifications}
            onOpenItem={openNotification}
            onMarkAll={markAllNotifications}
          />
          <button
            type="button"
            onClick={() => setOpen(true)}
            aria-haspopup="true"
            aria-expanded={open}
            aria-label="메뉴 열기"
            className="flex h-11 min-w-[64px] items-center justify-center gap-1.5 rounded-lg border border-line text-[15px] font-medium"
          >
            메뉴
          </button>
        </div>
      </header>

      {/* 모바일 전체화면 메뉴 시트 */}
      {open ? (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="메뉴"
          className="fixed inset-0 z-40 flex flex-col bg-surface pb-[env(safe-area-inset-bottom)] lg:hidden"
        >
          <div className="flex items-center justify-between border-b border-line px-4 py-3 pt-[max(0.75rem,env(safe-area-inset-top))]">
            <div className="flex items-center gap-2.5">
              <AppMark size={24} />
              <p className="text-[15px] font-semibold">한아름</p>
            </div>
            <button
              type="button"
              onClick={() => setOpen(false)}
              aria-label="메뉴 닫기"
              className="flex h-11 min-w-[64px] items-center justify-center rounded-lg border border-line text-[15px] font-medium"
            >
              닫기
            </button>
          </div>
          <div className="flex flex-1 flex-col overflow-y-auto">{bodyBlock}</div>
        </div>
      ) : null}

      <div className="flex min-w-0 flex-col">
        {isDemo ? (
          <p className="no-print bg-warn-soft px-4 py-2 text-center text-xs text-warn">
            데모 데이터입니다. 여기 있는 학생·교직원은 모두 가상 인물입니다.
          </p>
        ) : null}

        <ZoneGuard schoolId={schoolId} />

        <main className="mx-auto w-full max-w-[1400px] flex-1 px-4 py-6 lg:px-8">{children}</main>
      </div>
    </div>
  )
}
