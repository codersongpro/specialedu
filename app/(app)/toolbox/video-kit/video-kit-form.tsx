'use client'

import { useActionState } from 'react'
import { Button, Card, Field, inputClass } from '@/components/ui'
import { createVideoKit, type VideoKitState } from './actions'

export interface VideoKitDefaults { title: string; url: string; durationSec: number }

export function VideoKitForm({ defaults }: { defaults: VideoKitDefaults }) {
  const [state, action, pending] = useActionState<VideoKitState, FormData>(createVideoKit, {})
  return <form action={action} className="space-y-4">
    <Card className="grid gap-3 p-5 sm:grid-cols-2">
      <Field label="과정" htmlFor="course"><input id="course" name="course" required className={inputClass} /></Field>
      <Field label="교과" htmlFor="subject"><input id="subject" name="subject" required className={inputClass} /></Field>
      <Field label="주제" htmlFor="topic"><input id="topic" name="topic" required maxLength={100} className={inputClass} /></Field>
      <Field label="목표 수준" htmlFor="level"><select id="level" name="level" className={inputClass}><option value="1">1단계 · 가장 쉬움</option><option value="2">2단계 · 보통</option><option value="3">3단계 · 원학년 수준</option></select></Field>
      <div className="sm:col-span-2"><Field label="선택한 영상 제목" htmlFor="videoTitle"><input id="videoTitle" name="videoTitle" required defaultValue={defaults.title} maxLength={200} className={inputClass} /></Field></div>
      <div className="sm:col-span-2"><Field label="영상 주소" htmlFor="videoUrl"><input id="videoUrl" name="videoUrl" required defaultValue={defaults.url} className={inputClass} /></Field></div>
      <Field label="영상 길이(초)" htmlFor="durationSec"><input id="durationSec" name="durationSec" type="number" min="0" max="14400" required defaultValue={defaults.durationSec} className={inputClass} /></Field>
      <Field label="Gemini 키" htmlFor="keySource" hint="학교 공용 키가 기본입니다."><select id="keySource" name="keySource" defaultValue="school" className={inputClass}><option value="school">학교 공용 키 사용</option><option value="personal">내 개인 키 사용</option></select></Field>
      <label className="sm:col-span-2 flex gap-2 text-sm"><input type="checkbox" name="confirmed" value="yes" required />영상 제목·주소·길이와 수업 조건만 외부 Gemini에 전송됨을 확인했습니다.</label>
      {state.error ? <p role="alert" className="sm:col-span-2 rounded-lg bg-danger-soft p-3 text-sm text-danger">{state.error}</p> : null}
      <div className="sm:col-span-2"><Button type="submit" disabled={pending}>{pending ? '만드는 중' : '꾸러미 만들고 개인 초안에 저장'}</Button></div>
    </Card>
    {state.result ? <Card className="whitespace-pre-wrap p-5 text-sm leading-7">{state.result}</Card> : null}
  </form>
}
