'use client'

import { useActionState, useState } from 'react'
import { Button, Field, inputClass } from '@/components/ui'
import { todayString } from '@/lib/date'
import { createAbsence, type AbsenceState } from './actions'

const REASONS = [
  { value: 'business_trip', label: '출장' },
  { value: 'sick', label: '병가' },
  { value: 'annual', label: '연가' },
  { value: 'training', label: '연수' },
  { value: 'official', label: '공가' },
  { value: 'other', label: '기타' },
] as const

export function AbsenceForm({
  me,
  teachers,
  canPickOthers,
}: {
  me: { id: string; name: string }
  teachers: Array<{ id: string; name: string }>
  canPickOthers: boolean
}) {
  const [state, formAction, pending] = useActionState<AbsenceState, FormData>(createAbsence, {})
  const [startsOn, setStartsOn] = useState(todayString())

  return (
    <form action={formAction} className="space-y-3">
      <Field label="누가" htmlFor="teacherId">
        {canPickOthers ? (
          <select id="teacherId" name="teacherId" defaultValue={me.id} className={inputClass}>
            {teachers.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
        ) : (
          <>
            <input type="hidden" name="teacherId" value={me.id} />
            <p className="flex h-9 items-center rounded-lg border border-line bg-canvas px-3 text-sm">
              {me.name}
            </p>
          </>
        )}
      </Field>

      <div className="grid grid-cols-2 gap-2">
        <Field label="시작일" htmlFor="startsOn">
          <input
            id="startsOn"
            name="startsOn"
            type="date"
            required
            value={startsOn}
            onChange={(e) => setStartsOn(e.target.value)}
            className={inputClass}
          />
        </Field>
        <Field label="종료일" htmlFor="endsOn">
          <input
            id="endsOn"
            name="endsOn"
            type="date"
            required
            defaultValue={startsOn}
            min={startsOn}
            key={startsOn}
            className={inputClass}
          />
        </Field>
      </div>

      <Field label="사유" htmlFor="reason">
        <select id="reason" name="reason" className={inputClass}>
          {REASONS.map((r) => (
            <option key={r.value} value={r.value}>
              {r.label}
            </option>
          ))}
        </select>
      </Field>

      <Field label="메모" htmlFor="note" hint="비워 둬도 됩니다">
        <input id="note" name="note" maxLength={300} className={inputClass} />
      </Field>

      {state.error ? (
        <p role="alert" className="rounded-lg bg-danger-soft px-3 py-2 text-sm text-danger">
          {state.error}
        </p>
      ) : null}

      {state.created != null ? (
        <p className="rounded-lg bg-ok-soft px-3 py-2 text-sm text-ok">
          {state.created === 0
            ? '해당 기간에 잡힌 수업이 없어 보강 대상은 없습니다'
            : `보강이 필요한 수업 ${state.created}개를 찾았습니다`}
        </p>
      ) : null}

      <Button type="submit" disabled={pending} className="w-full">
        {pending ? '처리 중' : '신청'}
      </Button>
    </form>
  )
}
