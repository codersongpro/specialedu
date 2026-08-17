'use client'

import { useActionState, useState } from 'react'
import { Button, Field, inputClass } from '@/components/ui'
import { createInvitation, type InviteState } from './actions'

const ROLES = [
  { value: 'teacher', label: '교사' },
  { value: 'part_time', label: '시간강사' },
  { value: 'staff', label: '실무사' },
  { value: 'manager', label: '부장' },
  { value: 'admin', label: '학교관리자' },
] as const

const EMPLOYMENTS = [
  { value: 'full_time', label: '정규' },
  { value: 'fixed_term', label: '기간제' },
  { value: 'part_time', label: '시간강사' },
  { value: 'assistant', label: '실무사·보조' },
] as const

/** 화면 표시용 직급 후보 — 학교마다 직제 명칭이 달라 목록에 없으면 직접 입력한다 */
const POSITIONS = [
  '교장',
  '교감',
  '수석교사',
  '교사',
  '보건교사',
  '영양교사',
  '사서교사',
  '전문상담교사',
  '행정실장',
  '주무관',
  '실무사',
  '사회복무요원',
]

export function InviteForm() {
  const [state, formAction, pending] = useActionState<InviteState, FormData>(
    createInvitation,
    {},
  )
  const [copied, setCopied] = useState(false)

  const fullLink = state.link
    ? `${typeof window === 'undefined' ? '' : window.location.origin}${state.link}`
    : ''

  return (
    <form action={formAction} className="space-y-3">
      <div className="grid grid-cols-2 gap-2">
        <Field label="이름" htmlFor="name">
          <input id="name" name="name" required maxLength={40} className={inputClass} />
        </Field>
        <Field label="이메일" htmlFor="email">
          <input id="email" name="email" type="email" required className={inputClass} />
        </Field>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <Field label="권한" htmlFor="role">
          <select id="role" name="role" className={inputClass} defaultValue="teacher">
            {ROLES.map((r) => (
              <option key={r.value} value={r.value}>
                {r.label}
              </option>
            ))}
          </select>
        </Field>
        <Field label="근무 형태" htmlFor="employment">
          <select id="employment" name="employment" className={inputClass} defaultValue="full_time">
            {EMPLOYMENTS.map((e) => (
              <option key={e.value} value={e.value}>
                {e.label}
              </option>
            ))}
          </select>
        </Field>
      </div>

      <Field label="직급 (선택)" htmlFor="position" hint="목록에 없으면 직접 입력하세요">
        <input
          id="position"
          name="position"
          list="position-options"
          maxLength={30}
          className={inputClass}
          placeholder="예: 교감"
        />
        <datalist id="position-options">
          {POSITIONS.map((p) => (
            <option key={p} value={p} />
          ))}
        </datalist>
      </Field>

      {state.error ? (
        <p role="alert" className="rounded-lg bg-danger-soft px-3 py-2 text-sm text-danger">
          {state.error}
        </p>
      ) : null}

      {state.link ? (
        <div className="rounded-lg bg-ok-soft p-3">
          <p className="text-xs font-medium text-ok">이 링크를 본인에게 전달하세요</p>
          <code className="mt-1.5 block break-all text-xs">{fullLink}</code>
          <button
            type="button"
            onClick={() => {
              void navigator.clipboard.writeText(fullLink)
              setCopied(true)
            }}
            className="mt-2 text-xs font-medium text-ok underline"
          >
            {copied ? '복사됨' : '복사'}
          </button>
        </div>
      ) : null}

      <Button type="submit" disabled={pending}>
        {pending ? '만드는 중' : '초대 링크 만들기'}
      </Button>
    </form>
  )
}
