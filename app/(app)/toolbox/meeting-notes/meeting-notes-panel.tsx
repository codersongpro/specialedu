'use client'

import { useState, useTransition } from 'react'
import { Button, Card, EmptyState, Field, inputClass } from '@/components/ui'
import { cn } from '@/lib/cn'
import { todayString } from '@/lib/date'
import { PII_KIND_LABEL } from '@/lib/security/pii'
import { deleteMeetingNote, previewMask, summarizeMeetingNote, type MaskPreviewResult } from './actions'

export interface MeetingNoteItem {
  id: string
  title: string
  meetingDate: string
  category: string | null
  rawText: string
  summary: string
  createdByName: string
  canDelete: boolean
}

export function MeetingNotesPanel({ items }: { items: MeetingNoteItem[] }) {
  const [title, setTitle] = useState('')
  const [meetingDate, setMeetingDate] = useState(todayString())
  const [category, setCategory] = useState('')
  const [rawText, setRawText] = useState('')

  const [preview, setPreview] = useState<MaskPreviewResult | null>(null)
  const [previewPending, startPreviewTransition] = useTransition()
  const [summary, setSummary] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [summarizePending, startSummarizeTransition] = useTransition()

  const [localItems, setLocalItems] = useState(items)

  function runPreview() {
    setError(null)
    startPreviewTransition(async () => {
      const r = await previewMask(rawText)
      setPreview(r)
    })
  }

  function submit() {
    setError(null)
    setSummary(null)
    startSummarizeTransition(async () => {
      const r = await summarizeMeetingNote({ title, meetingDate, category: category || undefined, rawText })
      if (r.error) {
        setError(r.error)
        return
      }
      setSummary(r.summary ?? null)
      setLocalItems((prev) => [
        {
          id: `temp-${Date.now()}`,
          title,
          meetingDate,
          category: category || null,
          rawText,
          summary: r.summary ?? '',
          createdByName: '나',
          canDelete: true,
        },
        ...prev,
      ])
      setTitle('')
      setCategory('')
      setRawText('')
      setPreview(null)
    })
  }

  const canSubmit = title.trim().length > 0 && rawText.trim().length > 0 && !preview?.blocked

  return (
    <div className="space-y-4">
      <Card className="p-5">
        <h2 className="text-sm font-semibold">새 협의록</h2>
        <div className="mt-3 grid gap-3">
          <div className="grid gap-2 sm:grid-cols-3">
            <Field label="제목" htmlFor="mn-title">
              <input id="mn-title" value={title} onChange={(e) => setTitle(e.target.value)} maxLength={120} className={inputClass} placeholder="예: 3학년 학년협의회" />
            </Field>
            <Field label="회의일" htmlFor="mn-date">
              <input id="mn-date" type="date" value={meetingDate} onChange={(e) => setMeetingDate(e.target.value)} className={inputClass} />
            </Field>
            <Field label="구분" htmlFor="mn-category" hint="선택 사항">
              <input id="mn-category" value={category} onChange={(e) => setCategory(e.target.value)} maxLength={60} className={inputClass} placeholder="예: 학년협의회" />
            </Field>
          </div>

          <Field label="회의 내용" htmlFor="mn-raw" hint="학생·학부모 이름은 넣지 마세요">
            <textarea
              id="mn-raw"
              value={rawText}
              onChange={(e) => {
                setRawText(e.target.value)
                setPreview(null)
              }}
              maxLength={4000}
              rows={6}
              className={cn(inputClass, 'h-auto py-2')}
            />
          </Field>

          <Button variant="secondary" onClick={runPreview} disabled={previewPending || !rawText.trim()} className="w-fit">
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

          {summary ? (
            <div className="rounded-lg bg-brand-soft px-3 py-2 text-[13.5px] text-brand">
              <p className="font-medium">요약 결과</p>
              <p className="mt-1 whitespace-pre-wrap">{summary}</p>
            </div>
          ) : null}

          <Button onClick={submit} disabled={summarizePending || !canSubmit} className="w-full">
            {summarizePending ? '요약 만드는 중' : '요약 만들고 저장'}
          </Button>
        </div>
      </Card>

      <Card>
        <h2 className="border-b border-line px-4 py-3 text-sm font-semibold">저장된 협의록</h2>
        {localItems.length === 0 ? (
          <EmptyState title="아직 저장된 협의록이 없습니다" hint="위에서 회의 내용을 적고 요약해 보세요" />
        ) : (
          <ul className="divide-y divide-line">
            {localItems.map((item) => (
              <NoteRow key={item.id} item={item} />
            ))}
          </ul>
        )}
      </Card>
    </div>
  )
}

function NoteRow({ item }: { item: MeetingNoteItem }) {
  const [open, setOpen] = useState(false)
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [removed, setRemoved] = useState(false)

  if (removed) return null

  return (
    <li className="px-4 py-3">
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
        {item.category ? (
          <span className="rounded bg-canvas px-1.5 py-0.5 text-xs font-medium text-ink-soft">{item.category}</span>
        ) : null}
        <span className="whitespace-nowrap text-[15px] font-medium">{item.title}</span>
        <span className="whitespace-nowrap text-[13.5px] text-ink-soft tabular">{item.meetingDate}</span>
        <span className="whitespace-nowrap text-[13px] text-ink-soft">작성: {item.createdByName}</span>
      </div>

      <div className="mt-1.5 flex flex-wrap items-center gap-2">
        <button type="button" onClick={() => setOpen((v) => !v)} className="text-[13.5px] text-brand underline">
          {open ? '접기' : '자세히 보기'}
        </button>
        {item.canDelete && !item.id.startsWith('temp-') ? (
          <button
            type="button"
            disabled={pending}
            onClick={() =>
              startTransition(async () => {
                const result = await deleteMeetingNote(item.id)
                if (result.error) setError(result.error)
                else setRemoved(true)
              })
            }
            className="text-[13.5px] text-ink-soft underline hover:text-danger"
          >
            삭제
          </button>
        ) : null}
      </div>

      {error ? <p className="mt-1 text-[13px] text-danger">{error}</p> : null}

      {open ? (
        <div className="mt-2 space-y-2 rounded-lg bg-canvas px-3 py-2 text-[13.5px]">
          <p className="whitespace-pre-wrap">
            <span className="font-medium">원본: </span>
            {item.rawText}
          </p>
          <p className="whitespace-pre-wrap">
            <span className="font-medium">요약: </span>
            {item.summary}
          </p>
        </div>
      ) : null}
    </li>
  )
}
