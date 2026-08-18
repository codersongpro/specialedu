'use client'

import { useState, useTransition } from 'react'
import { Button, Card, Field, inputClass } from '@/components/ui'
import { cn } from '@/lib/cn'
import { PII_KIND_LABEL } from '@/lib/security/pii'
import { convertLevels, previewMask, type MaskPreviewResult } from './actions'

const LEVEL_META = [
  { key: 'high' as const, label: '상', hint: '원문과 비슷한 수준' },
  { key: 'mid' as const, label: '중', hint: '쉬운 낱말 위주' },
  { key: 'low' as const, label: '하', hint: '아주 짧고 쉬운 문장' },
]

export function MaterialLevelsForm() {
  const [text, setText] = useState('')
  const [subject, setSubject] = useState('')

  const [preview, setPreview] = useState<MaskPreviewResult | null>(null)
  const [previewPending, startPreviewTransition] = useTransition()
  const [result, setResult] = useState<{ high: string; mid: string; low: string } | null>(null)
  const [copiedKey, setCopiedKey] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  function runPreview() {
    setResult(null)
    startPreviewTransition(async () => {
      const r = await previewMask(text)
      setPreview(r)
    })
  }

  function submit() {
    setError(null)
    setResult(null)
    startTransition(async () => {
      const r = await convertLevels({ text, subject: subject || undefined })
      if (r.error) setError(r.error)
      else if (r.high && r.mid && r.low) setResult({ high: r.high, mid: r.mid, low: r.low })
    })
  }

  async function copy(value: string, key: string) {
    try {
      await navigator.clipboard.writeText(value)
      setCopiedKey(key)
      setTimeout(() => setCopiedKey((v) => (v === key ? null : v)), 1500)
    } catch {
      // 클립보드 권한이 없으면 조용히 무시
    }
  }

  const canSubmit = text.trim().length > 0 && !preview?.blocked

  return (
    <div className="space-y-4">
      <Card className="p-5">
        <h2 className="text-sm font-semibold">입력</h2>
        <div className="mt-3 space-y-3">
          <Field label="교과 (선택)" htmlFor="subject">
            <input id="subject" value={subject} onChange={(e) => setSubject(e.target.value)} maxLength={40} className={inputClass} />
          </Field>

          <Field label="원본 자료" htmlFor="text" hint="학생 이름은 넣지 마세요. 3000자 이내">
            <textarea
              id="text"
              value={text}
              onChange={(e) => {
                setText(e.target.value)
                setPreview(null)
              }}
              maxLength={3000}
              rows={8}
              className={cn(inputClass, 'h-auto py-2')}
            />
          </Field>

          <Button variant="secondary" onClick={runPreview} disabled={previewPending || !text.trim()}>
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
            {pending ? '만드는 중' : '3단계로 변환하기'}
          </Button>
        </div>
      </Card>

      {result ? (
        <div className="grid gap-4 sm:grid-cols-3">
          {LEVEL_META.map((m) => (
            <Card key={m.key} className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <span className="block text-sm font-semibold">{m.label}</span>
                  <span className="block text-[12px] text-ink-soft">{m.hint}</span>
                </div>
                <button
                  type="button"
                  onClick={() => copy(result[m.key], m.key)}
                  className="text-[12.5px] text-brand underline"
                >
                  {copiedKey === m.key ? '복사됨' : '복사'}
                </button>
              </div>
              <p className="mt-2 whitespace-pre-wrap text-[14px]">{result[m.key]}</p>
            </Card>
          ))}
        </div>
      ) : null}
    </div>
  )
}
