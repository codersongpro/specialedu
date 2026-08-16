'use client'

import { useActionState } from 'react'
import { Button, inputClass } from '@/components/ui'
import { cn } from '@/lib/cn'
import type { SubstitutionWeights } from '@/lib/substitution/score'
import { saveWeights, type WeightsState } from './actions'

const FIELDS: Array<{ key: keyof SubstitutionWeights; label: string; hint: string }> = [
  { key: 'partTimeFirst', label: '시간강사 우선', hint: '시간강사에게 먼저 배정' },
  { key: 'sameSubject', label: '같은 교과', hint: '그 교과를 맡고 있는 분' },
  { key: 'sameCourseGrade', label: '같은 과정·학년', hint: '학년까지 맞으면 만점, 과정만이면 절반' },
  { key: 'homeroomOfClass', label: '이 학급 담임', hint: '담임·부담임' },
  { key: 'fairnessMax', label: '결보강 형평성', hint: '이번 주에 적게 한 분일수록 가점' },
  { key: 'longRunPenalty', label: '연강 감점', hint: '음수로 두세요' },
  { key: 'sameFloorBonus', label: '같은 층', hint: '앞뒤 교시와 같은 층이면 가점' },
]

export function WeightsForm({
  weights,
  longRunThreshold,
}: {
  weights: SubstitutionWeights
  longRunThreshold: number
}) {
  const [state, formAction, pending] = useActionState<WeightsState, FormData>(saveWeights, {})

  return (
    <form action={formAction} className="space-y-2.5">
      {FIELDS.map((field) => (
        <div key={field.key} className="flex items-center gap-3">
          <div className="min-w-0 flex-1">
            <label htmlFor={field.key} className="block text-sm">
              {field.label}
            </label>
            <span className="text-xs text-ink-soft">{field.hint}</span>
          </div>
          <input
            id={field.key}
            name={field.key}
            type="number"
            defaultValue={weights[field.key]}
            min={-100}
            max={100}
            className={cn(inputClass, 'w-20 text-right tabular')}
          />
        </div>
      ))}

      <div className="flex items-center gap-3 border-t border-line pt-2.5">
        <div className="min-w-0 flex-1">
          <label htmlFor="longRunThreshold" className="block text-sm">
            연강 기준
          </label>
          <span className="text-xs text-ink-soft">몇 교시부터 감점할지</span>
        </div>
        <input
          id="longRunThreshold"
          name="longRunThreshold"
          type="number"
          defaultValue={longRunThreshold}
          min={2}
          max={10}
          className={cn(inputClass, 'w-20 text-right tabular')}
        />
      </div>

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
