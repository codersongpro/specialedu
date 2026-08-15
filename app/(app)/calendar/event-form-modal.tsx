'use client'

import { useEffect, useState } from 'react'
import { Button } from '@/components/ui'
import { EventForm } from './event-form'

/**
 * "행사 넣기"를 캘린더 옆에 항상 붙어 있는 칸이 아니라, 버튼을 눌렀을 때만
 * 캘린더 위에 겹쳐 뜨는 창으로 보여준다. 아무것도 입력하지 않은 채 배경을
 * 누르거나 Esc, 닫기 버튼으로 그냥 닫을 수 있다 — 취소에 확인을 요구하지 않는다.
 */
export function EventFormModal({
  allClasses,
}: {
  allClasses: Array<{ id: string; name: string }>
}) {
  const [open, setOpen] = useState(false)

  useEffect(() => {
    if (!open) return
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') setOpen(false)
    }
    document.addEventListener('keydown', onKeyDown)
    const prevOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKeyDown)
      document.body.style.overflow = prevOverflow
    }
  }, [open])

  return (
    <>
      <Button onClick={() => setOpen(true)}>행사 넣기</Button>

      {open ? (
        <div
          className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-ink/40 px-4 py-8 sm:items-center"
          onClick={() => setOpen(false)}
        >
          <div
            className="w-full max-w-sm rounded-[14px] border border-line bg-surface p-4 shadow-xl"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-base font-semibold">행사 넣기</h2>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="-mr-2 -mt-1 rounded-lg px-2 py-1 text-[15px] text-ink-soft hover:bg-canvas"
              >
                닫기
              </button>
            </div>
            <EventForm allClasses={allClasses} onSuccess={() => setOpen(false)} />
          </div>
        </div>
      ) : null}
    </>
  )
}
