'use client'

import { useState, useTransition } from 'react'
import { AREA_LABEL } from '@/app/(app)/support/iep/labels'
import { Button, Card, Field, inputClass } from '@/components/ui'
import { cn } from '@/lib/cn'
import { PII_KIND_LABEL } from '@/lib/security/pii'
import type { IepArea } from '@/lib/supabase/database.types'
import { draftGoals, previewMask, type MaskPreviewResult } from './actions'

const AREAS = Object.entries(AREA_LABEL) as Array<[IepArea, string]>

export function IepDraftForm() {
  const [area, setArea] = useState<IepArea>(AREAS[0]![0])
  const [currentLevel, setCurrentLevel] = useState('')

  const [preview, setPreview] = useState<MaskPreviewResult | null>(null)
  const [previewPending, startPreviewTransition] = useTransition()
  const [goals, setGoals] = useState<string[] | null>(null)
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  function runPreview() {
    setGoals(null)
    startPreviewTransition(async () => {
      const r = await previewMask(currentLevel)
      setPreview(r)
    })
  }

  function submit() {
    setError(null)
    setGoals(null)
    startTransition(async () => {
      const r = await draftGoals({ areaLabel: AREA_LABEL[area], currentLevel })
      if (r.error) setError(r.error)
      else setGoals(r.goals ?? [])
    })
  }

  async function copy(text: string, index: number) {
    try {
      await navigator.clipboard.writeText(text)
      setCopiedIndex(index)
      setTimeout(() => setCopiedIndex((v) => (v === index ? null : v)), 1500)
    } catch {
      // 클립보드 권한이 없으면 조용히 무시 — 사용자가 직접 드래그해 복사할 수 있다
    }
  }

  const canSubmit = currentLevel.trim().length > 0 && !preview?.blocked

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Card className="p-5">
        <h2 className="text-sm font-semibold">입력</h2>
        <div className="mt-3 space-y-3">
          <Field label="영역" htmlFor="area">
            <select id="area" value={area} onChange={(e) => setArea(e.target.value as IepArea)} className={inputClass}>
              {AREAS.map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </Field>

          <Field label="현재 수준" htmlFor="currentLevel" hint="학생 이름은 넣지 마세요. 500자 이내">
            <textarea
              id="currentLevel"
              value={currentLevel}
              onChange={(e) => {
                setCurrentLevel(e.target.value)
                setPreview(null)
              }}
              maxLength={500}
              rows={6}
              className={cn(inputClass, 'h-auto py-2')}
              placeholder="예: 그림카드 3장 중 원하는 것을 손으로 가리켜 표현할 수 있음"
            />
          </Field>

          <Button variant="secondary" onClick={runPreview} disabled={previewPending || !currentLevel.trim()}>
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
            {pending ? '만드는 중' : '목표 문장 만들기'}
          </Button>
        </div>
      </Card>

      <Card className="p-5">
        <h2 className="text-sm font-semibold">목표 문장 후보</h2>
        <p className="mt-1 text-[13px] text-ink-soft">
          마음에 드는 문장을 복사해 IEP 목표 등록 화면에 붙여넣으세요. 여기서는 저장되지 않습니다.
        </p>
        {goals && goals.length > 0 ? (
          <ul className="mt-3 space-y-2">
            {goals.map((g, i) => (
              <li key={i} className="rounded-lg border border-line px-3 py-2">
                <p className="text-[14px]">{g}</p>
                <button
                  type="button"
                  onClick={() => copy(g, i)}
                  className="mt-1.5 text-[12.5px] text-brand underline"
                >
                  {copiedIndex === i ? '복사됨' : '복사'}
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <div className="mt-3 flex h-full min-h-[160px] items-center justify-center rounded-[14px] border border-dashed border-line text-[13.5px] text-ink-soft">
            왼쪽에서 내용을 채우고 만들면 여기에 후보가 보입니다
          </div>
        )}
      </Card>
    </div>
  )
}
