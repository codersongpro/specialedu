'use client'

import { useActionState } from 'react'
import { Button, Card, Field, inputClass } from '@/components/ui'
import { adaptLesson, type LessonAdaptState } from './actions'

export function LessonAdaptForm() {
  const [state, action, pending] = useActionState<LessonAdaptState, FormData>(adaptLesson, {})
  return <form action={action} className="space-y-4">
    <Card className="grid gap-3 p-5 sm:grid-cols-2">
      <Field label="과정" htmlFor="course"><input id="course" name="course" required className={inputClass} placeholder="예: 고등" /></Field>
      <Field label="교과" htmlFor="subject"><input id="subject" name="subject" required className={inputClass} placeholder="예: 국어" /></Field>
      <Field label="주제" htmlFor="topic"><input id="topic" name="topic" required maxLength={100} className={inputClass} /></Field>
      <Field label="목표 수준" htmlFor="level"><select id="level" name="level" className={inputClass}><option value="1">1단계 · 가장 쉬움</option><option value="2">2단계 · 보통</option><option value="3">3단계 · 원학년 수준</option></select></Field>
      <Field label="수업 시간(분)" htmlFor="duration"><input id="duration" name="duration" type="number" min="10" max="240" defaultValue="40" className={inputClass} /></Field>
      <Field label="준비 가능 재료" htmlFor="supplies"><input id="supplies" name="supplies" maxLength={300} className={inputClass} /></Field>
      <div className="sm:col-span-2"><Field label="수업 목표" htmlFor="objective"><textarea id="objective" name="objective" required maxLength={300} className={inputClass} /></Field></div>
      <div className="sm:col-span-2"><Field label="현재 자료" htmlFor="material" hint="학생 이름·연락처·진단명·가정 정보는 넣지 마세요."><textarea id="material" name="material" required maxLength={3000} rows={7} className={inputClass} /></Field></div>
      <label className="sm:col-span-2 flex gap-2 text-sm"><input type="checkbox" name="confirmed" value="yes" required />학생 이름·연락처·얼굴·서명·진단명·가정 정보가 없음을 확인했습니다.</label>
      {state.error ? <p role="alert" className="sm:col-span-2 rounded-lg bg-danger-soft p-3 text-sm text-danger">{state.error}</p> : null}
      <div className="sm:col-span-2"><Button type="submit" disabled={pending}>{pending ? '변환 중' : '변환하고 개인 초안에 저장'}</Button></div>
    </Card>
    {state.result ? <Card className="whitespace-pre-wrap p-5 text-sm leading-7">{state.result}</Card> : null}
  </form>
}
