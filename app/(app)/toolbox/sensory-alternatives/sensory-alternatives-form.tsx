'use client'

import { useState, useTransition } from 'react'
import { Button, Card, Field, inputClass } from '@/components/ui'
import { cn } from '@/lib/cn'
import { PII_KIND_LABEL } from '@/lib/security/pii'
import { draftAlternatives, previewMask, type MaskPreviewResult } from './actions'
import { SENSITIVITY_LABEL, SENSITIVITY_VALUES_LIST, type SensitivityValue } from './labels'

export function SensoryAlternativesForm() {
  const [activity, setActivity] = useState('')
  const [sensitivities, setSensitivities] = useState<SensitivityValue[]>([])
  const [note, setNote] = useState('')

  const [preview, setPreview] = useState<MaskPreviewResult | null>(null)
  const [previewPending, startPreviewTransition] = useTransition()
  const [alternatives, setAlternatives] = useState<string[] | null>(null)
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  function toggleSensitivity(value: SensitivityValue) {
    setSensitivities((prev) => (prev.includes(value) ? prev.filter((v) => v !== value) : [...prev, value]))
  }

  function runPreview() {
    setAlternatives(null)
    startPreviewTransition(async () => {
      const r = await previewMask(`${activity}\n${note}`)
      setPreview(r)
    })
  }

  function submit() {
    setError(null)
    setAlternatives(null)
    startTransition(async () => {
      const r = await draftAlternatives({ activity, sensitivities, note: note || undefined })
      if (r.error) setError(r.error)
      else setAlternatives(r.alternatives ?? [])
    })
  }

  async function copy(text: string, index: number) {
    try {
      await navigator.clipboard.writeText(text)
      setCopiedIndex(index)
      setTimeout(() => setCopiedIndex((v) => (v === index ? null : v)), 1500)
    } catch {
      // 클립보드 권한이 없으면 조용히 무시
    }
  }

  const canSubmit = activity.trim().length > 0 && sensitivities.length > 0 && !preview?.blocked

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Card className="p-5">
        <h2 className="text-sm font-semibold">입력</h2>
        <div className="mt-3 space-y-3">
          <Field label="원래 활동" htmlFor="activity" hint="예: 체육관에서 줄넘기">
            <input
              id="activity"
              value={activity}
              onChange={(e) => {
                setActivity(e.target.value)
                setPreview(null)
              }}
              maxLength={120}
              className={inputClass}
            />
          </Field>

          <Field label="고려할 감각특성" htmlFor="sensitivities">
            <div className="space-y-1.5">
              {SENSITIVITY_VALUES_LIST.map((value) => (
                <label key={value} className="flex items-center gap-2 text-[14px]">
                  <input
                    type="checkbox"
                    checked={sensitivities.includes(value)}
                    onChange={() => toggleSensitivity(value)}
                    className="h-4 w-4"
                  />
                  {SENSITIVITY_LABEL[value]}
                </label>
              ))}
            </div>
          </Field>

          <Field label="추가 설명" htmlFor="note" hint="선택 사항. 학생 이름은 넣지 마세요">
            <textarea
              id="note"
              value={note}
              onChange={(e) => {
                setNote(e.target.value)
                setPreview(null)
              }}
              maxLength={500}
              rows={3}
              className={cn(inputClass, 'h-auto py-2')}
            />
          </Field>

          <Button variant="secondary" onClick={runPreview} disabled={previewPending || !activity.trim()}>
            {previewPending ? '확인 중' : '전송 전 미리보기'}
          </Button>

          {preview ? (
            <div className={cn('rounded-lg px-3 py-2 text-[13.5px]', preview.blocked ? 'bg-danger-soft text-danger' : 'bg-canvas text-ink-soft')}>
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
                    <p className="mt-1 font-medium">주민등록번호·계좌번호는 가려도 보낼 수 없습니다. 내용에서 지워 주세요.</p>
                  ) : null}
                </>
              )}
            </div>
          ) : null}

          {error ? (
            <p role="alert" className="rounded-lg bg-danger-soft px-3 py-2 text-sm text-danger">
              {error}
            </p>
          ) : null}

          <Button onClick={submit} disabled={pending || !canSubmit} className="w-full">
            {pending ? '만드는 중' : '대안 활동 만들기'}
          </Button>
        </div>
      </Card>

      <Card className="p-5">
        <h2 className="text-sm font-semibold">대안 활동</h2>
        {alternatives && alternatives.length > 0 ? (
          <ul className="mt-3 space-y-2">
            {alternatives.map((a, i) => (
              <li key={i} className="rounded-lg border border-line px-3 py-2">
                <p className="text-[14px]">{a}</p>
                <button type="button" onClick={() => copy(a, i)} className="mt-1.5 text-[12.5px] text-brand underline">
                  {copiedIndex === i ? '복사됨' : '복사'}
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <div className="mt-3 flex h-full min-h-[160px] items-center justify-center rounded-[14px] border border-dashed border-line text-[13.5px] text-ink-soft">
            왼쪽에서 입력하고 만들면 여기에 대안이 보입니다
          </div>
        )}
      </Card>
    </div>
  )
}
