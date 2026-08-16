'use client'

import { useActionState } from 'react'
import { Button, Card, Field, inputClass } from '@/components/ui'
import { createWorkflowDraft, type WorkflowState } from './actions'

const COPY = {
  document_checklist: { title: '공문·매뉴얼 체크리스트', description: '비민감 공문 또는 매뉴얼 본문에서 일정·담당·준비물·확인 항목을 추립니다.', label: '문서 본문' },
  trip_plan: { title: '행사·체험학습 운영표', description: '일정과 인솔자 역할, 준비물, 비상 절차, 귀교 확인을 운영표로 정리합니다.', label: '계획 메모' },
  meeting_notes: { title: '회의 메모 정리', description: '결정 사항·담당 업무·마감일만 간단히 정리합니다.', label: '회의 메모' },
} as const
type Tool = keyof typeof COPY

export function AutomationForm({ tool }: { tool: Tool }) {
  const [state, action, pending] = useActionState<WorkflowState, FormData>(createWorkflowDraft, {})
  const copy = COPY[tool]
  return <form action={action} className="space-y-4"><Card className="space-y-3 p-5"><input type="hidden" name="tool" value={tool} /><Field label="초안 제목" htmlFor="title"><input id="title" name="title" required maxLength={120} className={inputClass} placeholder={copy.title} /></Field><Field label={copy.label} htmlFor="source" hint="학생 이름·진단명·보호자 연락처·참석자 실명은 입력하지 마세요."><textarea id="source" name="source" required maxLength={6000} rows={12} className={inputClass} /></Field><Field label="Gemini 키" htmlFor="keySource" hint="학교 공용 키가 기본입니다."><select id="keySource" name="keySource" defaultValue="school" className={inputClass}><option value="school">학교 공용 키 사용</option><option value="personal">내 개인 키 사용</option></select></Field><label className="flex gap-2 text-sm"><input type="checkbox" name="confirmed" value="yes" required />비민감 자료만 입력했고, 마스킹된 본문이 외부 Gemini에 전송됨을 확인했습니다.</label>{state.error ? <p role="alert" className="rounded-lg bg-danger-soft p-3 text-sm text-danger">{state.error}</p> : null}<Button type="submit" disabled={pending}>{pending ? '정리 중' : '정리하고 개인 초안에 저장'}</Button></Card>{state.result ? <Card className="whitespace-pre-wrap p-5 text-sm leading-7">{state.result}</Card> : null}</form>
}
