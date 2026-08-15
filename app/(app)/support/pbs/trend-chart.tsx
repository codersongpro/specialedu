import { cn } from '@/lib/cn'

export interface TrendWeek {
  label: string
  rangeLabel: string
  count: number
}

/**
 * 최근 몇 주간 기록 건수 — 단일 지표(빈도)라 막대 하나짜리 순차 인코딩이면
 * 충분하다. 굳이 여러 색을 쓰지 않는다.
 */
export function TrendChart({ weeks }: { weeks: TrendWeek[] }) {
  const max = Math.max(1, ...weeks.map((w) => w.count))

  return (
    <div>
      <div className="flex h-32 items-end gap-1.5">
        {weeks.map((week) => {
          const heightPct = (week.count / max) * 100
          return (
            <div key={week.label} className="group relative flex h-full flex-1 flex-col justify-end">
              <div
                className={cn(
                  'w-full rounded-t-[4px] transition-colors',
                  week.count > 0 ? 'bg-brand' : 'bg-line',
                )}
                style={{ height: `${Math.max(heightPct, 3)}%` }}
              />
              <div className="pointer-events-none absolute -top-9 left-1/2 z-10 -translate-x-1/2 whitespace-nowrap rounded-md bg-ink px-2 py-1 text-[11px] text-white opacity-0 transition-opacity group-hover:opacity-100">
                {week.count}건 · {week.rangeLabel}
              </div>
            </div>
          )
        })}
      </div>
      <div className="mt-1.5 flex gap-1.5">
        {weeks.map((week) => (
          <span key={week.label} className="flex-1 text-center text-[11px] text-ink-soft">
            {week.label}
          </span>
        ))}
      </div>
    </div>
  )
}
