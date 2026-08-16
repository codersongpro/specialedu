'use client'

import { useActionState, useState, useTransition } from 'react'
import { Button, Card, Field, inputClass } from '@/components/ui'
import { adaptLesson, previewLessonMask, type LessonAdaptState, type LessonMaskPreview } from './actions'

export function LessonAdaptForm() {
  const [state, action, pending] = useActionState<LessonAdaptState, FormData>(adaptLesson, {})
  const [preview, setPreview] = useState<LessonMaskPreview | null>(null)
  const [previewing, startPreview] = useTransition()
  function previewMask(form: HTMLFormElement) {
    const data = new FormData(form)
    startPreview(async () => setPreview(await previewLessonMask({
      topic: String(data.get('topic') ?? ''), objective: String(data.get('objective') ?? ''), material: String(data.get('material') ?? ''), supplies: String(data.get('supplies') ?? ''),
    })))
  }
  return <form action={action} className="space-y-4">
    <Card className="grid gap-3 p-5 sm:grid-cols-2">
      <Field label="과정" htmlFor="course"><input id="course" name="course" required className={inputClass} placeholder="예: 고등" /></Field>
      <Field label="교과" htmlFor="subject"><input id="subject" name="subject" required className={inputClass} placeholder="예: 국어" /></Field>
      <Field label="주제" htmlFor="topic"><input id="topic" name="topic" required maxLength={100} className={inputClass} /></Field>
      <Field label="목표 수준" htmlFor="level"><select id="level" name="level" className={inputClass}><option value="1">1단계 · 가장 쉬움</option><option value="2">2단계 · 보통</option><option value="3">3단계 · 원학년 수준</option></select></Field>
      <Field label="수업 시간(분)" htmlFor="duration"><input id="duration" name="duration" type="number" min="10" max="240" defaultValue="40" className={inputClass} /></Field>
      <Field label="준비 가능 재료" htmlFor="supplies"><input id="supplies" name="supplies" maxLength={300} className={inputClass} /></Field>
      <Field label="Gemini 키" htmlFor="keySource" hint="학교 공용 키가 기본입니다."><select id="keySource" name="keySource" defaultValue="school" className={inputClass}><option value="school">학교 공용 키 사용</option><option value="personal">내 개인 키 사용</option></select></Field>
      <div className="sm:col-span-2"><Field label="수업 목표" htmlFor="objective"><textarea id="objective" name="objective" required maxLength={300} className={inputClass} /></Field></div>
      <div className="sm:col-span-2"><Field label="현재 자료" htmlFor="material" hint="학생 이름·연락처·진단명·가정 정보는 넣지 마세요."><textarea id="material" name="material" required maxLength={3000} rows={7} className={inputClass} /></Field></div>
      <div className="sm:col-span-2"><Field label="첨부 자료" htmlFor="attachments" hint="PNG·JPEG·WebP·PDF만, 최대 3개·각 10MB·PDF 20쪽 이하. 얼굴·손글씨·서명 자료는 올릴 수 없습니다."><input id="attachments" name="attachments" type="file" multiple accept=".pdf,.png,.jpg,.jpeg,.webp,application/pdf,image/png,image/jpeg,image/webp" className={inputClass} /></Field></div>
      <div className="sm:col-span-2"><Button type="button" variant="secondary" onClick={(event) => previewMask(event.currentTarget.form!)} disabled={previewing}>{previewing ? '확인 중' : '마스킹 미리보기'}</Button></div>
      {preview ? <div className="sm:col-span-2 rounded-lg bg-canvas p-3 text-sm"><p className="font-medium">외부 전송 전 미리보기</p><pre className="mt-2 whitespace-pre-wrap font-sans text-ink-soft">{preview.masked || '마스킹할 텍스트가 없습니다.'}</pre>{preview.findings.length > 0 ? <p className="mt-2 text-xs text-ink-soft">감지 항목: {preview.findings.join(', ')}</p> : null}{preview.blocked ? <p className="mt-2 text-danger">주민등록번호 또는 계좌번호가 감지되어 전송할 수 없습니다.</p> : null}</div> : null}
      <label className="sm:col-span-2 flex gap-2 text-sm"><input type="checkbox" name="confirmed" value="yes" required />학생 이름·연락처·얼굴·서명·진단명·가정 정보가 없고, 첨부 자료와 입력 내용이 외부 Gemini에 전송됨을 확인했습니다.</label>
      {state.error ? <p role="alert" className="sm:col-span-2 rounded-lg bg-danger-soft p-3 text-sm text-danger">{state.error}</p> : null}
      <div className="sm:col-span-2"><Button type="submit" disabled={pending}>{pending ? '변환 중' : '변환하고 개인 초안에 저장'}</Button></div>
    </Card>
    {state.result ? <Card className="whitespace-pre-wrap p-5 text-sm leading-7">{state.result}</Card> : null}
  </form>
}
