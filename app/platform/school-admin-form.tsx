'use client'

import { useActionState, useState } from 'react'
import { Button, inputClass } from '@/components/ui'
import { inviteSchoolAdmin, type InviteAdminState } from './actions'

/** 학교 카드 안에 접어 둔 "관리자 지정" 미니 폼 */
export function SchoolAdminForm({ schoolId }: { schoolId: string }) {
  const [open, setOpen] = useState(false)
  const [state, formAction, pending] = useActionState<InviteAdminState, FormData>(
    inviteSchoolAdmin,
    {},
  )
  const [copied, setCopied] = useState(false)

  const fullLink = state.link
    ? `${typeof window === 'undefined' ? '' : window.location.origin}${state.link}`
    : ''

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="text-xs font-medium text-brand underline"
      >
        관리자 지정
      </button>
    )
  }

  return (
    <form action={formAction} className="space-y-2 rounded-lg border border-line bg-canvas p-3">
      <input type="hidden" name="schoolId" value={schoolId} />

      <div className="grid grid-cols-2 gap-2">
        <input
          name="name"
          placeholder="이름"
          required
          maxLength={40}
          className={`${inputClass} bg-surface`}
        />
        <input
          name="email"
          type="email"
          placeholder="이메일"
          required
          className={`${inputClass} bg-surface`}
        />
      </div>

      {state.error ? <p className="text-xs text-danger">{state.error}</p> : null}

      {state.link ? (
        <div className="rounded-md bg-ok-soft p-2">
          <code className="block break-all text-[11px]">{fullLink}</code>
          <button
            type="button"
            onClick={() => {
              void navigator.clipboard.writeText(fullLink)
              setCopied(true)
            }}
            className="mt-1 text-[11px] font-medium text-ok underline"
          >
            {copied ? '복사됨' : '복사'}
          </button>
        </div>
      ) : null}

      <div className="flex gap-2">
        <Button type="submit" disabled={pending} className="h-8 text-xs">
          {pending ? '만드는 중' : '초대 링크 만들기'}
        </Button>
        <Button type="button" variant="secondary" className="h-8 text-xs" onClick={() => setOpen(false)}>
          닫기
        </Button>
      </div>
    </form>
  )
}
