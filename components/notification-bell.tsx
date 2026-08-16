'use client'

import { useEffect, useState } from 'react'
import type { NotificationItem } from '@/app/actions/notifications'

function timeAgo(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime()
  const min = Math.floor(diffMs / 60000)
  if (min < 1) return '방금'
  if (min < 60) return `${min}분 전`
  const hour = Math.floor(min / 60)
  if (hour < 24) return `${hour}시간 전`
  return `${Math.floor(hour / 24)}일 전`
}

/**
 * 알림 벨 — 순수 표시용 컴포넌트다.
 *
 * 목록을 가져오고 Realtime을 구독하는 로직은 여기 두지 않는다. 이
 * 벨은 데스크톱 사이드바와 모바일 상단바 두 곳에 동시에 떠 있는데,
 * 각자 따로 구독하면 같은 채널 토픽(notifications:{profileId})을
 * 두 번 subscribe() 하게 돼 "cannot add postgres_changes callbacks
 * after subscribe()" 오류가 난다. 그래서 상태는 AppShell 이 한 번만
 * 갖고, 이 컴포넌트는 목록만 받아 보여준다.
 */
export function NotificationBell({
  items,
  onOpenItem,
  onMarkAll,
}: {
  items: NotificationItem[]
  onOpenItem: (item: NotificationItem) => void
  onMarkAll: () => void
}) {
  const [open, setOpen] = useState(false)

  useEffect(() => {
    if (!open) return
    function onClickOutside(event: MouseEvent) {
      if (!(event.target as HTMLElement).closest('[data-notification-bell]')) setOpen(false)
    }
    document.addEventListener('click', onClickOutside)
    return () => document.removeEventListener('click', onClickOutside)
  }, [open])

  const unreadCount = items.filter((item) => !item.readAt).length

  return (
    <div className="relative" data-notification-bell>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label="알림"
        aria-expanded={open}
        className="relative flex h-11 w-11 shrink-0 items-center justify-center rounded-lg text-ink-soft hover:bg-canvas"
      >
        <svg viewBox="0 0 24 24" fill="none" className="size-5" aria-hidden>
          <path
            d="M18 16v-5a6 6 0 1 0-12 0v5l-1.5 2.5h15L18 16Z"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinejoin="round"
          />
          <path d="M10 21a2 2 0 0 0 4 0" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
        </svg>
        {unreadCount > 0 ? (
          <span className="absolute right-1.5 top-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-danger px-1 text-[10px] font-semibold text-white">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        ) : null}
      </button>

      {open ? (
        <div className="absolute right-0 top-12 z-50 w-80 max-w-[calc(100vw-2rem)] rounded-[14px] border border-line bg-surface shadow-xl">
          <div className="flex items-center justify-between border-b border-line px-3 py-2.5">
            <span className="text-[14px] font-semibold">알림</span>
            {unreadCount > 0 ? (
              <button type="button" onClick={onMarkAll} className="text-[12.5px] text-brand underline">
                모두 읽음
              </button>
            ) : null}
          </div>
          <ul className="max-h-96 overflow-y-auto">
            {items.length === 0 ? (
              <li className="px-3 py-6 text-center text-[13.5px] text-ink-soft">알림이 없습니다</li>
            ) : (
              items.map((item) => (
                <li key={item.id} className="border-b border-line last:border-0">
                  <button
                    type="button"
                    onClick={() => {
                      setOpen(false)
                      onOpenItem(item)
                    }}
                    className={`block w-full px-3 py-2.5 text-left hover:bg-canvas ${item.readAt ? '' : 'bg-brand-soft/40'}`}
                  >
                    <p className="text-[13.5px] font-medium">{item.title}</p>
                    {item.body ? <p className="mt-0.5 text-[12.5px] text-ink-soft">{item.body}</p> : null}
                    <p className="mt-0.5 text-[11.5px] text-ink-soft">{timeAgo(item.createdAt)}</p>
                  </button>
                </li>
              ))
            )}
          </ul>
        </div>
      ) : null}
    </div>
  )
}
