'use client'

import { useState, useTransition } from 'react'
import { Button, EmptyState, Field, inputClass } from '@/components/ui'
import { searchMedia, type MediaSearchResult } from './actions'

const COURSES = [
  { value: 'elementary', label: '초등' },
  { value: 'middle', label: '중학' },
  { value: 'high', label: '고등' },
  { value: 'vocational', label: '전공과' },
]
const LEVELS = [
  { value: 1 as const, label: '가장 쉬움' },
  { value: 2 as const, label: '보통' },
  { value: 3 as const, label: '원학년 수준' },
]
const LENGTHS = [
  { value: 'any' as const, label: '전체' },
  { value: 'short' as const, label: '짧게(4분 미만)' },
  { value: 'medium' as const, label: '보통(4~20분)' },
  { value: 'long' as const, label: '길게(20분 초과)' },
]

export function MediaSearchForm({ subjects }: { subjects: Array<{ id: string; name: string }> }) {
  const [course, setCourse] = useState('elementary')
  const [level, setLevel] = useState<1 | 2 | 3>(2)
  const [topic, setTopic] = useState('')
  const [subject, setSubject] = useState('')
  const [lengthBucket, setLengthBucket] = useState<'any' | 'short' | 'medium' | 'long'>('any')

  const [pending, startTransition] = useTransition()
  const [result, setResult] = useState<MediaSearchResult | null>(null)

  function submit() {
    if (!topic.trim()) return
    startTransition(async () => {
      const r = await searchMedia({ course: course as never, level, topic, subject, lengthBucket })
      setResult(r)
    })
  }

  return (
    <div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Field label="과정" htmlFor="course">
          <select id="course" value={course} onChange={(e) => setCourse(e.target.value)} className={inputClass}>
            {COURSES.map((c) => (
              <option key={c.value} value={c.value}>
                {c.label}
              </option>
            ))}
          </select>
        </Field>

        <Field label="교과" htmlFor="subject" hint="선택 사항">
          <select id="subject" value={subject} onChange={(e) => setSubject(e.target.value)} className={inputClass}>
            <option value="">고르지 않음</option>
            {subjects.map((s) => (
              <option key={s.id} value={s.name}>
                {s.name}
              </option>
            ))}
          </select>
        </Field>

        <Field label="학생 수준" htmlFor="level">
          <select
            id="level"
            value={level}
            onChange={(e) => setLevel(Number(e.target.value) as 1 | 2 | 3)}
            className={inputClass}
          >
            {LEVELS.map((l) => (
              <option key={l.value} value={l.value}>
                {l.label}
              </option>
            ))}
          </select>
        </Field>

        <Field label="영상 길이" htmlFor="length">
          <select
            id="length"
            value={lengthBucket}
            onChange={(e) => setLengthBucket(e.target.value as typeof lengthBucket)}
            className={inputClass}
          >
            {LENGTHS.map((l) => (
              <option key={l.value} value={l.value}>
                {l.label}
              </option>
            ))}
          </select>
        </Field>
      </div>

      <div className="mt-3">
        <Field label="제재·주제" htmlFor="topic" hint="예: 가을 낙엽, 분리수거, 교통 표지판">
          <input id="topic" value={topic} onChange={(e) => setTopic(e.target.value)} maxLength={100} className={inputClass} />
        </Field>
      </div>

      {result?.error ? (
        <p role="alert" className="mt-3 rounded-lg bg-danger-soft px-3 py-2 text-sm text-danger">
          {result.error}
        </p>
      ) : null}

      <Button onClick={submit} disabled={pending || !topic.trim()} className="mt-3">
        {pending ? '찾는 중' : '자료 찾기'}
      </Button>

      {result?.videos ? (
        <div className="mt-5">
          {result.cached ? <p className="mb-2 text-[13px] text-ink-soft">최근 검색 결과입니다(캐시)</p> : null}
          {result.videos.length === 0 ? (
            <EmptyState title="조건에 맞는 영상을 찾지 못했습니다" hint="주제를 더 넓게 적어 다시 찾아보세요" />
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {result.videos.map((video) => (
                <VideoCard key={video.videoId} video={video} />
              ))}
            </div>
          )}
        </div>
      ) : null}
    </div>
  )
}

function formatDuration(sec: number | null): string {
  if (sec == null) return ''
  const m = Math.floor(sec / 60)
  const s = sec % 60
  return `${m}:${String(s).padStart(2, '0')}`
}

function VideoCard({
  video,
}: {
  video: { videoId: string; title: string; channelTitle: string; thumbnailUrl: string; durationSec: number | null }
}) {
  const [preview, setPreview] = useState(false)

  return (
    <div className="overflow-hidden rounded-[14px] border border-line bg-surface">
      {preview ? (
        <div className="aspect-video w-full bg-ink">
          <iframe
            src={`https://www.youtube-nocookie.com/embed/${video.videoId}`}
            title={video.title}
            className="h-full w-full"
            allow="accelerometer; autoplay; encrypted-media; picture-in-picture"
            allowFullScreen
          />
        </div>
      ) : (
        <button type="button" onClick={() => setPreview(true)} className="relative block w-full">
          {video.thumbnailUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={video.thumbnailUrl} alt={video.title} className="aspect-video w-full object-cover" />
          ) : (
            <div className="aspect-video w-full bg-canvas" />
          )}
          {video.durationSec != null ? (
            <span className="absolute bottom-1.5 right-1.5 rounded bg-ink/80 px-1.5 py-0.5 text-[11px] text-white">
              {formatDuration(video.durationSec)}
            </span>
          ) : null}
        </button>
      )}
      <div className="p-2.5">
        <p className="line-clamp-2 text-[13.5px] font-medium">{video.title}</p>
        <p className="mt-0.5 text-[12.5px] text-ink-soft">{video.channelTitle}</p>
        <a
          href={`https://www.youtube.com/watch?v=${video.videoId}`}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-1.5 inline-block text-[12.5px] text-brand underline"
        >
          유튜브에서 보기
        </a>
        <a
          href={`/toolbox/video-kit?videoId=${encodeURIComponent(video.videoId)}&title=${encodeURIComponent(video.title)}&duration=${video.durationSec ?? 0}`}
          className="mt-1.5 ml-3 inline-block text-[12.5px] text-brand underline"
        >
          수업 꾸러미 만들기
        </a>
      </div>
    </div>
  )
}
