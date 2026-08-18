'use client'

import { useState, useTransition } from 'react'
import { Button, Field, inputClass } from '@/components/ui'
import { cn } from '@/lib/cn'
import { PII_KIND_LABEL } from '@/lib/security/pii'
import { generateNotice, previewMask, saveNotice, type MaskPreviewResult, type NoticeResult } from './actions'

const NOTICE_TYPES = ['현장체험학습', '준비물', '행사', '일정변경', '급식', '기타']
const COURSES = [
  { value: 'elementary', label: '초등' },
  { value: 'middle', label: '중학' },
  { value: 'high', label: '고등' },
  { value: 'vocational', label: '전공과' },
]
const LEVELS = [
  { value: 1 as const, label: '그림 위주', hint: '한 문장 3~5어절, 그림 포함' },
  { value: 2 as const, label: '짧은 문장', hint: '쉬운 낱말 위주' },
  { value: 3 as const, label: '문장만 다듬기', hint: '원문과 비슷한 수준' },
]

export function NoticeForm({ classes }: { classes: Array<{ id: string; name: string }> }) {
  const [noticeType, setNoticeType] = useState(NOTICE_TYPES[0]!)
  const [title, setTitle] = useState('')
  const [date, setDate] = useState('')
  const [place, setPlace] = useState('')
  const [itemsText, setItemsText] = useState('')
  const [scope, setScope] = useState<'school' | 'course' | 'grade' | 'class'>('school')
  const [course, setCourse] = useState('elementary')
  const [grade, setGrade] = useState(1)
  const [classId, setClassId] = useState(classes[0]?.id ?? '')
  const [level, setLevel] = useState<1 | 2 | 3>(2)
  const [detail, setDetail] = useState('')

  const [preview, setPreview] = useState<MaskPreviewResult | null>(null)
  const [previewPending, startPreviewTransition] = useTransition()
  const [result, setResult] = useState<NoticeResult | null>(null)
  const [generatePending, startGenerateTransition] = useTransition()
  const [savePending, startSaveTransition] = useTransition()
  const [saveMsg, setSaveMsg] = useState<string | null>(null)

  const courseLabel = COURSES.find((c) => c.value === course)?.label ?? '전체'
  const audience =
    scope === 'school'
      ? '전체 학생'
      : scope === 'course'
        ? `${courseLabel} 전체`
        : scope === 'grade'
          ? `${courseLabel} ${grade}학년`
          : (classes.find((c) => c.id === classId)?.name ?? '학급')

  function runPreview() {
    setResult(null)
    startPreviewTransition(async () => {
      const r = await previewMask(detail)
      setPreview(r)
    })
  }

  function submit() {
    setSaveMsg(null)
    startGenerateTransition(async () => {
      const r = await generateNotice({
        noticeType,
        title,
        date,
        place,
        items: itemsText
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean),
        audience,
        level,
        detail,
      })
      setResult(r)
    })
  }

  function save() {
    if (!result?.text) return
    setSaveMsg(null)
    startSaveTransition(async () => {
      const r = await saveNotice({
        noticeType,
        title,
        date,
        place,
        items: itemsText
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean),
        audience,
        level,
        detail,
        output: result.text!,
      })
      setSaveMsg(r.error ?? '자료함에 저장했습니다')
    })
  }

  const canSubmit = title.trim().length > 0 && !preview?.blocked

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <div className="space-y-3">
        <Field label="안내 종류" htmlFor="noticeType">
          <select
            id="noticeType"
            value={noticeType}
            onChange={(e) => setNoticeType(e.target.value)}
            className={inputClass}
          >
            {NOTICE_TYPES.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </Field>

        <Field label="제목" htmlFor="title">
          <input id="title" value={title} onChange={(e) => setTitle(e.target.value)} maxLength={120} className={inputClass} />
        </Field>

        <div className="grid grid-cols-2 gap-2">
          <Field label="날짜" htmlFor="date" hint="선택 사항">
            <input id="date" type="date" value={date} onChange={(e) => setDate(e.target.value)} className={inputClass} />
          </Field>
          <Field label="장소" htmlFor="place" hint="선택 사항">
            <input id="place" value={place} onChange={(e) => setPlace(e.target.value)} maxLength={120} className={inputClass} />
          </Field>
        </div>

        <Field label="준비물" htmlFor="items" hint="쉼표로 구분, 선택 사항">
          <input
            id="items"
            value={itemsText}
            onChange={(e) => setItemsText(e.target.value)}
            placeholder="예: 물통, 편한 신발, 모자"
            className={inputClass}
          />
        </Field>

        <Field label="누구에게 보내나요" htmlFor="scope">
          <select
            id="scope"
            value={scope}
            onChange={(e) => setScope(e.target.value as typeof scope)}
            className={inputClass}
          >
            <option value="school">전교</option>
            <option value="course">과정</option>
            <option value="grade">학년</option>
            <option value="class">학급</option>
          </select>
        </Field>

        {scope === 'course' || scope === 'grade' ? (
          <div className="grid grid-cols-2 gap-2">
            <Field label="과정" htmlFor="course">
              <select id="course" value={course} onChange={(e) => setCourse(e.target.value)} className={inputClass}>
                {COURSES.map((c) => (
                  <option key={c.value} value={c.value}>
                    {c.label}
                  </option>
                ))}
              </select>
            </Field>
            {scope === 'grade' ? (
              <Field label="학년" htmlFor="grade">
                <input
                  id="grade"
                  type="number"
                  min={1}
                  max={6}
                  value={grade}
                  onChange={(e) => setGrade(Number(e.target.value))}
                  className={inputClass}
                />
              </Field>
            ) : null}
          </div>
        ) : null}

        {scope === 'class' ? (
          <Field label="학급" htmlFor="classId">
            <select id="classId" value={classId} onChange={(e) => setClassId(e.target.value)} className={inputClass}>
              {classes.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </Field>
        ) : null}

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

        <Field label="안내사항" htmlFor="detail" hint="학생 이름은 넣지 마세요. 200자 이내 권장">
          <textarea
            id="detail"
            value={detail}
            onChange={(e) => {
              setDetail(e.target.value)
              setPreview(null)
            }}
            maxLength={1000}
            rows={4}
            className={cn(inputClass, 'h-auto py-2')}
          />
        </Field>

        <Button variant="secondary" onClick={runPreview} disabled={previewPending || !detail.trim()}>
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
                    주민등록번호·계좌번호는 가려도 보낼 수 없습니다. 안내사항에서 지워 주세요.
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
          {generatePending ? '만드는 중' : '쉬운글 안내문 만들기'}
        </Button>
      </div>

      <div>
        {result?.text ? (
          <>
            <NoticePreview
              title={title}
              date={date}
              place={place}
              text={result.text}
              pictograms={result.pictograms ?? []}
            />
            <Button variant="secondary" className="mt-2 w-full" onClick={save} disabled={savePending}>
              {savePending ? '저장 중' : '자료함에 저장하기'}
            </Button>
            {saveMsg ? <p className="mt-1.5 text-center text-[13px] text-ink-soft">{saveMsg}</p> : null}
          </>
        ) : (
          <div className="flex h-full min-h-[240px] items-center justify-center rounded-[14px] border border-dashed border-line text-[13.5px] text-ink-soft">
            왼쪽에서 내용을 채우고 만들면 여기에 결과가 보입니다
          </div>
        )}
      </div>
    </div>
  )
}

function NoticePreview({
  title,
  date,
  place,
  text,
  pictograms,
}: {
  title: string
  date: string
  place: string
  text: string
  pictograms: Array<{ keyword: string; url: string | null }>
}) {
  return (
    <div>
      <div id="notice-print-area" className="rounded-[14px] border border-line bg-surface p-5">
        <h2 className="text-[19px] font-bold">{title || '안내문'}</h2>
        {date || place ? (
          <p className="mt-1 text-[14px] text-ink-soft">
            {date}
            {date && place ? ' · ' : ''}
            {place}
          </p>
        ) : null}
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
