'use client'

import { useState, useTransition } from 'react'
import { Button, Field, inputClass } from '@/components/ui'
import { cn } from '@/lib/cn'
import { PII_KIND_LABEL } from '@/lib/security/pii'
import { generateSchedule, previewMask, type MaskPreviewResult, type VisualScheduleResult } from './actions'

interface Row {
  time: string
  activity: string
}

function emptyRow(): Row {
  return { time: '', activity: '' }
}

export function VisualScheduleForm() {
  const [title, setTitle] = useState('')
  const [rows, setRows] = useState<Row[]>([emptyRow(), emptyRow()])

  const [preview, setPreview] = useState<MaskPreviewResult | null>(null)
  const [previewPending, startPreviewTransition] = useTransition()
  const [result, setResult] = useState<VisualScheduleResult | null>(null)
  const [generatePending, startGenerateTransition] = useTransition()

  function updateRow(index: number, patch: Partial<Row>) {
    setRows((prev) => prev.map((row, i) => (i === index ? { ...row, ...patch } : row)))
    setPreview(null)
  }

  function addRow() {
    if (rows.length >= 12) return
    setRows((prev) => [...prev, emptyRow()])
  }

  function removeRow(index: number) {
    setRows((prev) => prev.filter((_, i) => i !== index))
    setPreview(null)
  }

  function runPreview() {
    setResult(null)
    startPreviewTransition(async () => {
      const r = await previewMask(rows.map((r) => r.activity).join('\n'))
      setPreview(r)
    })
  }

  function submit() {
    startGenerateTransition(async () => {
      const r = await generateSchedule({
        title,
        items: rows
          .filter((r) => r.activity.trim())
          .map((r) => ({ time: r.time.trim() || undefined, activity: r.activity.trim() })),
      })
      setResult(r)
    })
  }

  const validRowCount = rows.filter((r) => r.activity.trim()).length
  const canSubmit = title.trim().length > 0 && validRowCount > 0 && !preview?.blocked

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <div className="space-y-3">
        <Field label="일과 제목" htmlFor="title" hint="예: 월요일 아침 일과">
          <input id="title" value={title} onChange={(e) => setTitle(e.target.value)} maxLength={120} className={inputClass} />
        </Field>

        <Field label="활동 목록" htmlFor="items" hint="학생 이름은 넣지 마세요">
          <div className="space-y-2">
            {rows.map((row, i) => (
              <div key={i} className="flex gap-2">
                <input
                  value={row.time}
                  onChange={(e) => updateRow(i, { time: e.target.value })}
                  placeholder="시간(선택)"
                  maxLength={20}
                  className={cn(inputClass, 'w-24 shrink-0')}
                />
                <input
                  value={row.activity}
                  onChange={(e) => updateRow(i, { activity: e.target.value })}
                  placeholder="활동 (예: 아침 인사)"
                  maxLength={60}
                  className={inputClass}
                />
                <button
                  type="button"
                  onClick={() => removeRow(i)}
                  disabled={rows.length <= 1}
                  className="shrink-0 rounded-lg px-2 text-ink-soft hover:text-danger disabled:opacity-30"
                  title="삭제"
                >
                  ✕
                </button>
              </div>
            ))}
          </div>
          <Button
            type="button"
            variant="secondary"
            onClick={addRow}
            disabled={rows.length >= 12}
            className="mt-2"
          >
            + 활동 추가
          </Button>
        </Field>

        <Button variant="secondary" onClick={runPreview} disabled={previewPending || validRowCount === 0}>
          {previewPending ? '확인 중' : '전송 전 미리보기'}
        </Button>

        {preview ? (
          <div
            className={cn(
              'rounded-lg px-3 py-2 text-[13.5px]',
              preview.blocked ? 'bg-danger-soft text-danger' : 'bg-canvas text-ink-soft',
            )}
          >
            {preview.findings.length === 0 ? (
              <p>가려질 개인정보가 없습니다.</p>
            ) : (
              <>
                <p className="font-medium">이렇게 가려서 전송됩니다:</p>
                <ul className="mt-1 list-disc pl-4">
                  {preview.findings.map((f, i) => (
                    <li key={i}>
                      {f.original} → {PII_KIND_LABEL[f.kind]}
                      {f.confidence === 'suspect' ? ' (추정)' : ''}
                    </li>
                  ))}
                </ul>
                {preview.blocked ? (
                  <p className="mt-1 font-medium">
                    주민등록번호·계좌번호는 가려도 보낼 수 없습니다. 활동 이름에서 지워 주세요.
                  </p>
                ) : null}
              </>
            )}
          </div>
        ) : null}

        {result?.error ? (
          <p role="alert" className="rounded-lg bg-danger-soft px-3 py-2 text-sm text-danger">
            {result.error}
          </p>
        ) : null}

        <Button onClick={submit} disabled={generatePending || !canSubmit} className="w-full">
          {generatePending ? '만드는 중' : '일과표 만들기'}
        </Button>
      </div>

      <div>
        {result?.items && result.items.length > 0 ? (
          <SchedulePreview title={title} items={result.items} />
        ) : (
          <div className="flex h-full min-h-[240px] items-center justify-center rounded-[14px] border border-dashed border-line text-[13.5px] text-ink-soft">
            왼쪽에서 활동을 채우고 만들면 여기에 일과표가 보입니다
          </div>
        )}
      </div>
    </div>
  )
}

function SchedulePreview({
  title,
  items,
}: {
  title: string
  items: Array<{ time: string; label: string; pictogramUrl: string | null }>
}) {
  return (
    <div>
      <div id="schedule-print-area" className="rounded-[14px] border border-line bg-surface p-5">
        <h2 className="text-[19px] font-bold">{title || '일과표'}</h2>
        <ol className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3">
          {items.map((item, i) => (
            <li key={i} className="flex flex-col items-center rounded-lg border border-line p-2 text-center">
              {item.pictogramUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={item.pictogramUrl} alt={item.label} className="h-16 w-16 object-contain" />
              ) : (
                <div className="flex h-16 w-16 items-center justify-center rounded bg-canvas text-[11px] text-ink-soft">
                  그림 없음
                </div>
              )}
              {item.time ? <span className="mt-1 text-[12px] text-ink-soft">{item.time}</span> : null}
              <span className="text-[13.5px] font-medium">{item.label}</span>
            </li>
          ))}
        </ol>
      </div>
      <Button variant="secondary" className="mt-3" onClick={() => window.print()}>
        인쇄 / PDF로 저장
      </Button>
    </div>
  )
}
