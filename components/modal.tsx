'use client'

import { useEffect } from 'react'
import { cn } from '@/lib/cn'

/**
 * 수정·입력용 공용 팝업.
 *
 * 배경(overflow-y-auto)이 스크롤을 떠안고, 카드 자체는 내용만큼만 커진다 —
 * 화면에 다 들어가는 보통 폼은 스크롤이 아예 안 생기고, 화면이 아주 작을
 * 때만(작은 폰 + 필드가 많은 폼) 배경이 스크롤되는 안전장치로 남는다.
 */
export function Modal({
  open,
  onClose,
  title,
  children,
  maxWidthClassName = 'max-w-md',
}: {
  open: boolean
  onClose: () => void
  title: string
  children: React.ReactNode
  maxWidthClassName?: string
}) {
  useEffect(() => {
    if (!open) return
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [open, onClose])

  if (!open) return null

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-ink/40 px-4 py-8 sm:items-center"
      onClick={onClose}
    >
      <div
        className={cn(
          'w-full rounded-[14px] border border-line bg-surface p-4 shadow-xl',
          maxWidthClassName,
        )}
        onClick={(event) => event.stopPropagation()}
      >
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-base font-semibold">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            className="-mr-2 -mt-1 rounded-lg px-2 py-1 text-[15px] text-ink-soft hover:bg-canvas"
          >
            닫기
          </button>
        </div>
        {children}
      </div>
    </div>
  )
}
