'use client'

import { useActionState } from 'react'
import { Badge, Button, Field, inputClass } from '@/components/ui'
import { saveSchoolKey, type WeightsState } from './actions'

/**
 * hint(뒷 4자리)를 폼 안에서 직접 보여준다.
 *
 * 예전엔 hasKey: boolean만 받아서 폼 라벨("API 키" ↔ "키 바꾸기")만
 * 바뀔 뿐, 폼만 봐서는 저장이 실제로 돼 있는지 알 수 없었다 — 힌트가
 * 폼 바깥(page.tsx)에만 있었기 때문이다.
 */
export function SchoolKeyForm({ hint }: { hint: string | null }) {
  const [state, formAction, pending] = useActionState<WeightsState, FormData>(saveSchoolKey, {})

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
