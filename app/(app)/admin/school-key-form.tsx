'use client'

import { useActionState } from 'react'
import { Button, Field, inputClass } from '@/components/ui'
import { saveSchoolKey, type WeightsState } from './actions'

export function SchoolKeyForm({ hasKey }: { hasKey: boolean }) {
  const [state, formAction, pending] = useActionState<WeightsState, FormData>(saveSchoolKey, {})

  return (
    <form action={formAction} className="space-y-3">
      <Field
        label={hasKey ? '키 바꾸기' : 'API 키'}
        htmlFor="schoolApiKey"
        hint="Google AI Studio에서 무료로 발급받을 수 있습니다"
      >
        <input
          id="schoolApiKey"
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
