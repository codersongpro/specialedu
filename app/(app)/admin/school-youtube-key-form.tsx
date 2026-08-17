'use client'

import { useActionState } from 'react'
import { Badge, Button, Field, inputClass } from '@/components/ui'
import { saveSchoolYoutubeKey, type WeightsState } from './actions'

/** hint(뒷 4자리)를 폼 안에서 직접 보여준다 — school-key-form.tsx와 같은 이유. */
export function SchoolYoutubeKeyForm({ hint }: { hint: string | null }) {
  const [state, formAction, pending] = useActionState<WeightsState, FormData>(saveSchoolYoutubeKey, {})

  return (
    <form action={formAction} className="space-y-3">
      <div className="flex items-center gap-2 text-sm">
        {hint ? (
          <>
            <Badge tone="ok">등록됨</Badge>
            <code className="text-xs text-ink-soft">{hint}</code>
          </>
        ) : (
          <Badge tone="warn">아직 등록되지 않음</Badge>
        )}
      </div>

      <Field
        label={hint ? '키 바꾸기' : 'API 키'}
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
