'use client'

import { useEffect, useState } from 'react'
import { usePathname } from 'next/navigation'
import { acknowledgeZone } from '@/app/actions/ack'
import { Button } from '@/components/ui'
import { cn } from '@/lib/cn'
import { sensitivityForPath, ZONE_WARNINGS } from '@/lib/security/sensitivity'

/**
 * 민감 구역 경고.
 *
 * 화면마다 개발자가 기억해서 붙이는 대신 레이아웃에서 경로를 보고 자동으로 건다.
 * 새 화면을 만들 때 경고를 빠뜨릴 수가 없다.
 *
 * 확인 모달은 세션당 한 번만 띄운다. 매번 뜨면 사람은 읽지 않고 닫게 되고,
 * 그러면 경고가 있으나 마나가 된다.
 */
export function ZoneGuard({ schoolId }: { schoolId: string }) {
  const pathname = usePathname()
  const sensitivity = sensitivityForPath(pathname)
  const [acked, setAcked] = useState(true)

  const zoneKey = sensitivity === 'normal' ? null : `zone-ack:${schoolId}:${sensitivity}`

  useEffect(() => {
    if (!zoneKey) {
      setAcked(true)
      return
    }
    setAcked(window.sessionStorage.getItem(zoneKey) === '1')
  }, [zoneKey])

  if (sensitivity === 'normal') return null

  const warning = ZONE_WARNINGS[sensitivity]

  function confirm() {
    if (!zoneKey) return
    window.sessionStorage.setItem(zoneKey, '1')
    setAcked(true)
    void acknowledgeZone(sensitivity)
  }

  return (
    <>
      <p
        className={cn(
          'no-print px-4 py-2 text-center text-xs font-medium',
          sensitivity === 'student_sensitive'
            ? 'bg-danger-soft text-danger'
            : 'bg-warn-soft text-warn',
        )}
      >
        {warning.banner}
      </p>

      {!acked ? (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="zone-warning-title"
          className="fixed inset-0 z-50 flex items-center justify-center bg-ink/40 px-6"
        >
          <div className="w-full max-w-md rounded-xl bg-surface p-6 shadow-lg">
            <h2 id="zone-warning-title" className="text-base font-semibold">
              {warning.title}
            </h2>
            <p className="mt-2.5 text-sm leading-relaxed text-ink-soft">{warning.body}</p>
            <div className="mt-6 flex justify-end gap-2">
              <Button variant="secondary" onClick={() => history.back()}>
                뒤로
              </Button>
              <Button onClick={confirm}>확인했습니다</Button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  )
}
