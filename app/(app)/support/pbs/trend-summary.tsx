'use client'

import { useState, useTransition } from 'react'
import { Button } from '@/components/ui'
import type { TrendBreakdown } from '@/lib/pbs/trend'
import { summarizePbsTrend } from './actions'

/**
 * "AI로 요약" — 이미 화면에 보이는 집계 수치만 넘긴다(재조회 없음).
 * 학생 이름·개별 기록 원문은 여기 전혀 없다는 걸 안내 문구로 명시한다.
 */
export function TrendSummary({ breakdown }: { breakdown: TrendBreakdown }) {
  const [summary, setSummary] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  function run() {
    setError(null)
    startTransition(async () => {
      const r = await summarizePbsTrend(breakdown)
      if (r.error) setError(r.error)
      else setSummary(r.summary ?? null)
    })
  }

  if (breakdown.totalCount === 0) return null

  return (
    <div className="mt-3 border-t border-line pt-3">
      <div className="flex items-center justify-between gap-2">
        <p className="text-[12.5px] text-ink-soft">학생 이름이나 개별 기록 원문은 전송되지 않습니다 — 집계 수치만 보냅니다.</p>
        <Button variant="secondary" onClick={run} disabled={pending}>
          {pending ? '요약 중' : 'AI로 요약'}
        </Button>
      </div>
      {error ? <p className="mt-2 text-[13px] text-danger">{error}</p> : null}
      {summary ? <p className="mt-2 whitespace-pre-wrap rounded-lg bg-canvas px-3 py-2 text-[13.5px]">{summary}</p> : null}
    </div>
  )
}
