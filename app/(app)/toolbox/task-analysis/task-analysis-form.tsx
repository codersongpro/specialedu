'use client'

import { useState, useTransition } from 'react'
import { Button, Card, Field, inputClass } from '@/components/ui'
import { cn } from '@/lib/cn'
import { PII_KIND_LABEL } from '@/lib/security/pii'
import { draftSteps, previewMask, type MaskPreviewResult } from './actions'

export function TaskAnalysisForm() {
  const [taskName, setTaskName] = useState('')
  const [currentLevel, setCurrentLevel] = useState('')

  const [preview, setPreview] = useState<MaskPreviewResult | null>(null)
  const [previewPending, startPreviewTransition] = useTransition()
  const [steps, setSteps] = useState<string[] | null>(null)
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null)
  const [copiedAll, setCopiedAll] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  function runPreview() {
    setSteps(null)
    startPreviewTransition(async () => {
      const r = await previewMask(`${taskName}\n${currentLevel}`)
      setPreview(r)
    })
  }

  function submit() {
    setError(null)
    setSteps(null)
    startTransition(async () => {
      const r = await draftSteps({ taskName, currentLevel: currentLevel || undefined })
      if (r.error) setError(r.error)
      else setSteps(r.steps ?? [])
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

  async function copyAll() {
    if (!steps) return
    try {
      await navigator.clipboard.writeText(steps.map((s, i) => `${i + 1}. ${s}`).join('\n'))
      setCopiedAll(true)
      setTimeout(() => setCopiedAll(false), 1500)
    } catch {
      // 클립보드 권한이 없으면 조용히 무시
    }
  }

  const canSubmit = taskName.trim().length > 0 && !preview?.blocked

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Card className="p-5">
        <h2 className="text-sm font-semibold">입력</h2>
        <div className="mt-3 space-y-3">
          <Field label="작업 이름" htmlFor="taskName" hint="예: 손 씻기, 커피 내리기, 세탁기 사용하기">
            <input
              id="taskName"
              value={taskName}
              onChange={(e) => {
                setTaskName(e.target.value)
                setPreview(null)
              }}
              maxLength={60}
              className={inputClass}
            />
          </Field>

          <Field label="현재 수행 수준" htmlFor="currentLevel" hint="선택 사항. 학생 이름은 넣지 마세요">
            <textarea
              id="currentLevel"
              value={currentLevel}
              onChange={(e) => {
                setCurrentLevel(e.target.value)
                setPreview(null)
              }}
              maxLength={500}
              rows={4}
              className={cn(inputClass, 'h-auto py-2')}
            />
          </Field>

          <Button variant="secondary" onClick={runPreview} disabled={previewPending || !taskName.trim()}>
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
            {pending ? '만드는 중' : '작업분석 만들기'}
          </Button>
        </div>
      </Card>

      <Card className="p-5">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold">단계별 목록</h2>
          {steps && steps.length > 0 ? (
            <button type="button" onClick={copyAll} className="text-[12.5px] text-brand underline">
              {copiedAll ? '전체 복사됨' : '전체 복사'}
            </button>
          ) : null}
        </div>
        {steps && steps.length > 0 ? (
          <ol className="mt-3 space-y-2">
            {steps.map((s, i) => (
              <li key={i} className="rounded-lg border border-line px-3 py-2">
                <p className="text-[14px]">
                  <span className="mr-1.5 font-semibold text-ink-soft">{i + 1}.</span>
                  {s}
                </p>
                <button type="button" onClick={() => copy(s, i)} className="mt-1.5 text-[12.5px] text-brand underline">
                  {copiedIndex === i ? '복사됨' : '복사'}
                </button>
              </li>
            ))}
          </ol>
        ) : (
          <div className="mt-3 flex h-full min-h-[160px] items-center justify-center rounded-[14px] border border-dashed border-line text-[13.5px] text-ink-soft">
            왼쪽에서 작업을 적고 만들면 여기에 단계가 보입니다
          </div>
        )}
      </Card>
    </div>
  )
}
