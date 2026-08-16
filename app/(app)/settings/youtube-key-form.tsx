'use client'

import { useActionState } from 'react'
import { Button, Field, inputClass } from '@/components/ui'
import { savePersonalYoutubeKey, type KeyState } from './actions'

export function YoutubeKeyForm() {
  const [state, formAction, pending] = useActionState<KeyState, FormData>(savePersonalYoutubeKey, {})

  return (
    <form action={formAction} className="space-y-3">
      <Field label="API 키" htmlFor="youtubeApiKey" hint="한 번 저장하면 다시 볼 수 없습니다">
        <input
          id="youtubeApiKey"
          name="apiKey"
          type="password"
          autoComplete="off"
          required
          className={inputClass}
          placeholder="AIza..."
        />
      </Field>

      {state.error ? (
        <p role="alert" className="rounded-lg bg-danger-soft px-3 py-2 text-sm text-danger">
          {state.error}
        </p>
      ) : null}
      {state.ok ? (
        <p className="rounded-lg bg-ok-soft px-3 py-2 text-sm text-ok">저장했습니다</p>
      ) : null}

      <Button type="submit" disabled={pending}>
        {pending ? '저장 중' : '저장'}
      </Button>
    </form>
  )
}
