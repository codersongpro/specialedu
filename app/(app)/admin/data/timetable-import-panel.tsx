'use client'

import { useRef, useState, useTransition } from 'react'
import { Button } from '@/components/ui'
import {
  commitTimetableImport,
  previewTimetableImport,
  type TimetableImportState,
} from './timetable-actions'

/**
 * 시간표 엑셀 업로드.
 *
 * 지금까지 정규 시간표(timetable_slots)를 채울 수 있는 화면이 전혀 없었다
 * — 데모 학교만 시드로 채워져 있었다. 실제 학교는 컴시간 같은 툴에서 뽑은
 * 시간표를 한 줄씩 입력할 수 없으니 엑셀로 한 번에 올린다.
 *
 * "미리보기"와 "반영하기"는 같은 파일을 두 번 보낸다 — 서버가 미리보기
 * 결과를 따로 들고 있다가 다음 요청에서 신뢰하는 구조보다, 매번 같은
 * 파일을 처음부터 다시 검증하는 편이 더 안전하다(그 사이 다른 사람이
 * 시간표를 바꿨을 수도 있어서 반영 시점에 다시 검사해야 한다).
 */
export function TimetableImportPanel({ classNames }: { classNames: string[] }) {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [fileName, setFileName] = useState<string | null>(null)
  const [result, setResult] = useState<TimetableImportState | null>(null)
  const [pending, startTransition] = useTransition()
  const [mode, setMode] = useState<'idle' | 'preview' | 'commit'>('idle')

  function runWithFile(commit: boolean) {
    const file = fileInputRef.current?.files?.[0]
    if (!file) {
      setResult({ error: '파일을 선택해 주세요' })
      return
    }
    const formData = new FormData()
    formData.set('file', file)

    setMode(commit ? 'commit' : 'preview')
    startTransition(async () => {
      const next = commit ? await commitTimetableImport(formData) : await previewTimetableImport(formData)
      setResult(next)
    })
  }

  function reset() {
    setResult(null)
    setFileName(null)
    setMode('idle')
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  return (
    <div className="space-y-4">
      <div className="rounded-xl bg-canvas p-4 text-sm leading-relaxed text-ink-soft">
        <p className="font-medium text-ink">순서: 양식 내려받기 → 채워 넣기 → 올려서 미리보기 → 반영하기</p>
        <p className="mt-1">
          담당교사·협력교사는 이 학교에 등록된 교직원 이름을 그대로 적어야 합니다.
          {classNames.length === 0
            ? ' 아직 학급이 하나도 없어 양식의 학급 목록이 비어 있습니다 — 먼저 "학급" 탭에서 만들어 주세요.'
            : ''}
        </p>
        <a
          href="/api/admin/timetable-template"
          className="mt-3 inline-flex h-10 items-center rounded-lg border border-line bg-surface px-3.5 text-sm font-medium hover:bg-canvas"
        >
          양식(.xlsx) 내려받기
        </a>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <input
          ref={fileInputRef}
          type="file"
          accept=".xlsx"
          onChange={(e) => {
            setFileName(e.target.files?.[0]?.name ?? null)
            setResult(null)
          }}
          className="text-sm"
        />
        <Button
          type="button"
          variant="secondary"
          disabled={!fileName || pending}
          onClick={() => runWithFile(false)}
        >
          {pending && mode === 'preview' ? '확인하는 중' : '미리보기'}
        </Button>
        {result && !result.error && result.validCount ? (
          <Button type="button" disabled={pending} onClick={() => runWithFile(true)}>
            {pending && mode === 'commit' ? '반영하는 중' : `${result.validCount}건 반영하기`}
          </Button>
        ) : null}
        {result ? (
          <button type="button" onClick={reset} className="text-sm text-ink-soft hover:underline">
            다시 시작
          </button>
        ) : null}
      </div>

      {result?.error ? (
        <p role="alert" className="rounded-lg bg-danger-soft px-3 py-2 text-sm text-danger">
          {result.error}
        </p>
      ) : null}

      {result?.committed ? (
        <p className="rounded-lg bg-brand-soft px-3 py-2 text-sm text-brand">
          {result.insertedCount}칸을 시간표에 반영했습니다. &ldquo;시간표&rdquo; 메뉴에서 확인할 수 있습니다.
        </p>
      ) : result && result.total != null ? (
        <p className="text-sm text-ink-soft">
          총 {result.total}행 중 <span className="font-medium text-ink">{result.validCount}행</span> 반영
          가능, <span className="font-medium text-danger">{result.errors?.length ?? 0}행</span> 오류
        </p>
      ) : null}

      {result?.errors && result.errors.length > 0 ? (
        <div className="max-h-72 overflow-y-auto rounded-xl border border-line">
          <table className="w-full text-sm">
            <thead className="sticky top-0 bg-surface">
              <tr className="border-b border-line text-left text-xs text-ink-soft">
                <th className="px-3 py-2">행</th>
                <th className="px-3 py-2">문제</th>
              </tr>
            </thead>
            <tbody>
              {result.errors.map((e, i) => (
                <tr key={`${e.row}-${i}`} className="border-b border-line last:border-0">
                  <td className="px-3 py-2 align-top tabular">{e.row}</td>
                  <td className="px-3 py-2 align-top text-danger">{e.message}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
    </div>
  )
}
