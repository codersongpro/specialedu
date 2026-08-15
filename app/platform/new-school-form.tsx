'use client'

import { useActionState, useState } from 'react'
import { Button, Field, inputClass } from '@/components/ui'
import { createSchool, type NewSchoolState } from './actions'

export function NewSchoolForm() {
  const [state, formAction, pending] = useActionState<NewSchoolState, FormData>(createSchool, {})
  const [copied, setCopied] = useState(false)

  const fullLink = state.link
    ? `${typeof window === 'undefined' ? '' : window.location.origin}${state.link}`
    : ''

  return (
    <form action={formAction} className="space-y-3">
      <Field label="학교 이름" htmlFor="name">
        <input id="name" name="name" required maxLength={80} className={inputClass} />
      </Field>

      <div className="grid grid-cols-2 gap-2">
        <Field label="관리자 이름" htmlFor="adminName">
          <input id="adminName" name="adminName" required maxLength={40} className={inputClass} />
        </Field>
        <Field label="관리자 이메일" htmlFor="adminEmail">
          <input id="adminEmail" name="adminEmail" type="email" required className={inputClass} />
        </Field>
      </div>

      <Field label="나이스 학교코드" htmlFor="neisCode" hint="비워 둬도 됩니다">
        <input id="neisCode" name="neisCode" maxLength={20} className={inputClass} />
      </Field>

      {state.error ? (
        <p role="alert" className="rounded-lg bg-danger-soft px-3 py-2 text-sm text-danger">
          {state.error}
        </p>
      ) : null}

      {state.link ? (
        <div className="rounded-lg bg-ok-soft p-3">
          <p className="text-xs font-medium text-ok">
            {state.schoolName}을 열었습니다. 이 링크를 관리자에게 전달하세요.
          </p>
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
        {pending ? '만드는 중' : '학교 열기'}
      </Button>
    </form>
  )
}
