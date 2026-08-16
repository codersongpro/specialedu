'use client'

import { useActionState } from 'react'
import { Button, Field, inputClass } from '@/components/ui'
import { saveSchoolYoutubeKey, type WeightsState } from './actions'

export function SchoolYoutubeKeyForm({ hasKey }: { hasKey: boolean }) {
  const [state, formAction, pending] = useActionState<WeightsState, FormData>(saveSchoolYoutubeKey, {})

  return (
    <form action={formAction} className="space-y-3">
      <Field
        label={hasKey ? '키 바꾸기' : 'API 키'}
        htmlFor="schoolYoutubeApiKey"
        hint="Google Cloud Console에서 YouTube Data API v3 키를 발급받습니다"
      >
        <input
          id="schoolYoutubeApiKey"
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
