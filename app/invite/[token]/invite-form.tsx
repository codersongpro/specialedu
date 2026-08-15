'use client'

import { useActionState } from 'react'
import { Button, Field, inputClass } from '@/components/ui'
import { acceptInvite, type AcceptState } from './actions'

export function InviteForm({ token }: { token: string }) {
  const [state, formAction, pending] = useActionState<AcceptState, FormData>(acceptInvite, {})

  return (
    <form action={formAction} className="mt-8 space-y-4">
      <input type="hidden" name="token" value={token} />

      <Field label="비밀번호" htmlFor="password" hint="10자 이상. 다른 곳에서 쓰는 비밀번호는 피하세요.">
        <input
          id="password"
          name="password"
          type="password"
          autoComplete="new-password"
          minLength={10}
          required
          className={inputClass}
        />
      </Field>

      <Field label="비밀번호 확인" htmlFor="confirm">
        <input
          id="confirm"
          name="confirm"
          type="password"
          autoComplete="new-password"
          required
          className={inputClass}
        />
      </Field>

      {state.error ? (
        <p role="alert" className="rounded-lg bg-danger-soft px-3 py-2 text-sm text-danger">
          {state.error}
        </p>
      ) : null}

      <Button type="submit" disabled={pending} className="w-full">
        {pending ? '만드는 중' : '계정 만들기'}
      </Button>
    </form>
  )
}
