'use client'

import { useState, useTransition } from 'react'
import { Button, Field, inputClass } from '@/components/ui'
import { cn } from '@/lib/cn'
import { PII_KIND_LABEL } from '@/lib/security/pii'
import { generateStory, previewMask, type MaskPreviewResult, type SocialStoryResult } from './actions'

const LEVELS = [
  { value: 1 as const, label: '그림 위주', hint: '한 문장 3~5어절, 그림 포함' },
  { value: 2 as const, label: '짧은 문장', hint: '쉬운 낱말 위주' },
  { value: 3 as const, label: '문장만 다듬기', hint: '원문과 비슷한 수준' },
]

export function SocialStoryForm() {
  const [title, setTitle] = useState('')
  const [situation, setSituation] = useState('')
  const [level, setLevel] = useState<1 | 2 | 3>(2)

  const [preview, setPreview] = useState<MaskPreviewResult | null>(null)
  const [previewPending, startPreviewTransition] = useTransition()
  const [result, setResult] = useState<SocialStoryResult | null>(null)
  const [generatePending, startGenerateTransition] = useTransition()

  function runPreview() {
    setResult(null)
    startPreviewTransition(async () => {
      const r = await previewMask(situation)
      setPreview(r)
    })
  }

  function submit() {
    startGenerateTransition(async () => {
      const r = await generateStory({ title, situation, level })
      setResult(r)
    })
  }

  const canSubmit = title.trim().length > 0 && situation.trim().length > 0 && !preview?.blocked

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <div className="space-y-3">
        <Field label="제목" htmlFor="title" hint="예: 화재 대피 훈련">
          <input id="title" value={title} onChange={(e) => setTitle(e.target.value)} maxLength={120} className={inputClass} />
        </Field>

        <Field label="쉬운글 수준" htmlFor="level">
          <div className="flex flex-wrap gap-1.5">
            {LEVELS.map((l) => (
              <button
                key={l.value}
                type="button"
                onClick={() => setLevel(l.value)}
                className={cn(
                  'rounded-lg border px-3 py-2 text-left text-sm transition-colors',
                  level === l.value ? 'border-brand bg-brand-soft text-brand' : 'border-line hover:bg-canvas',
                )}
              >
                <span className="block font-medium">{l.label}</span>
                <span className="block text-[12px] text-ink-soft">{l.hint}</span>
              </button>
            ))}
          </div>
        </Field>

        <Field label="상황" htmlFor="situation" hint="학생 이름은 넣지 마세요. 500자 이내 권장">
          <textarea
            id="situation"
            value={situation}
            onChange={(e) => {
              setSituation(e.target.value)
              setPreview(null)
            }}
            maxLength={1000}
            rows={5}
            className={cn(inputClass, 'h-auto py-2')}
            placeholder="예: 매주 화요일 오전에 화재 대피 훈련 사이렌이 울립니다. 갑자기 큰 소리가 나면 놀랄 수 있습니다."
          />
        </Field>

        <Button variant="secondary" onClick={runPreview} disabled={previewPending || !situation.trim()}>
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
                    주민등록번호·계좌번호는 가려도 보낼 수 없습니다. 상황 설명에서 지워 주세요.
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
          {generatePending ? '만드는 중' : '사회적 이야기 만들기'}
        </Button>
      </div>

      <div>
        {result?.text ? (
          <StoryPreview title={title} text={result.text} pictograms={result.pictograms ?? []} />
        ) : (
          <div className="flex h-full min-h-[240px] items-center justify-center rounded-[14px] border border-dashed border-line text-[13.5px] text-ink-soft">
            왼쪽에서 내용을 채우고 만들면 여기에 결과가 보입니다
          </div>
        )}
      </div>
    </div>
  )
}

function StoryPreview({
  title,
  text,
  pictograms,
}: {
  title: string
  text: string
  pictograms: Array<{ keyword: string; url: string | null }>
}) {
  return (
    <div>
      <div id="story-print-area" className="rounded-[14px] border border-line bg-surface p-5">
        <h2 className="text-[19px] font-bold">{title || '사회적 이야기'}</h2>
        <p className="mt-3 whitespace-pre-wrap text-[16px] leading-relaxed">{text}</p>

        {pictograms.some((p) => p.url) ? (
          <div className="mt-4 flex flex-wrap gap-3 border-t border-line pt-3">
            {pictograms
              .filter((p) => p.url)
              .map((p) => (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  key={p.keyword}
                  src={p.url!}
                  alt={p.keyword}
                  className="h-20 w-20 rounded-lg border border-line object-contain p-1"
                />
              ))}
          </div>
        ) : null}
      </div>
      <Button variant="secondary" className="mt-3" onClick={() => window.print()}>
        인쇄 / PDF로 저장
      </Button>
    </div>
  )
}
