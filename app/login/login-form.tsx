'use client'

import { useActionState } from 'react'
import { Button, Field, inputClass } from '@/components/ui'
import { login, type LoginState } from './actions'

export function LoginForm({ next }: { next?: string }) {
  const [state, formAction, pending] = useActionState<LoginState, FormData>(login, {})

  return (
    <form action={formAction} className="mt-8 space-y-4">
      {next ? <input type="hidden" name="next" value={next} /> : null}

      <Field label="이메일" htmlFor="email">
        <input
          id="email"
          name="email"
          type="email"
          autoComplete="username"
          required
          className={inputClass}
          placeholder="hong@school.kr"
        />
      </Field>

      <Field label="비밀번호" htmlFor="password">
        <input
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
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
        {pending ? '확인 중' : '로그인'}
      </Button>
    </form>
  )
}
