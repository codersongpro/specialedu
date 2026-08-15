'use client'

import { useActionState, useState } from 'react'
import { Button, Field, inputClass } from '@/components/ui'
import { todayString } from '@/lib/date'
import { createEvent, type EventState } from './actions'

const CATEGORIES = [
  { value: 'class_event', label: '학급행사' },
  { value: 'grade_event', label: '학년행사' },
  { value: 'course_event', label: '과정행사' },
  { value: 'academic', label: '학사일정' },
  { value: 'exam', label: '평가' },
  { value: 'training', label: '연수·협의회' },
  { value: 'vacation', label: '방학' },
  { value: 'holiday', label: '휴업일' },
  { value: 'other', label: '기타' },
] as const

const COURSES = [
  { value: 'elementary', label: '초등' },
  { value: 'middle', label: '중학' },
  { value: 'high', label: '고등' },
  { value: 'vocational', label: '전공과' },
] as const

export function EventForm({
  classes,
  allClasses,
  canPickAnyScope,
}: {
  classes: Array<{ id: string; name: string }>
  allClasses: Array<{ id: string; name: string }>
  canPickAnyScope: boolean
}) {
  const [state, formAction, pending] = useActionState<EventState, FormData>(createEvent, {})
  const [scope, setScope] = useState<string>(canPickAnyScope ? 'school' : 'class')
  const [startsOn, setStartsOn] = useState(todayString())

  const pickableClasses = canPickAnyScope ? allClasses : classes

  // 담임이 아니면 학급 행사만 넣을 수 있다. RLS 에서도 같은 규칙이 걸려 있다.
  const scopeOptions = canPickAnyScope
    ? [
        { value: 'school', label: '전교' },
        { value: 'course', label: '과정' },
        { value: 'grade', label: '학년' },
        { value: 'class', label: '학급' },
      ]
    : [{ value: 'class', label: '학급' }]

  if (!canPickAnyScope && classes.length === 0) {
    return (
      <p className="text-sm text-ink-soft">
        담임을 맡은 학급이 없어 행사를 넣을 수 없습니다. 학교 전체 일정은 교무부에 요청하세요.
      </p>
    )
  }

  return (
    <form action={formAction} className="space-y-3">
      <Field label="행사 이름" htmlFor="title">
        <input id="title" name="title" required maxLength={120} className={inputClass} />
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
            defaultValue={startsOn}
            min={startsOn}
            key={startsOn}
            className={inputClass}
          />
        </Field>
      </div>

      <Field label="누구 일정인가요" htmlFor="scope">
        <select
          id="scope"
          name="scope"
          value={scope}
          onChange={(e) => setScope(e.target.value)}
          className={inputClass}
        >
          {scopeOptions.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      </Field>

      {scope === 'course' || scope === 'grade' ? (
        <div className="grid grid-cols-2 gap-2">
          <Field label="과정" htmlFor="scopeCourse">
            <select id="scopeCourse" name="scopeCourse" className={inputClass}>
              {COURSES.map((c) => (
                <option key={c.value} value={c.value}>
                  {c.label}
                </option>
              ))}
            </select>
          </Field>
          {scope === 'grade' ? (
            <Field label="학년" htmlFor="scopeGrade">
              <input
                id="scopeGrade"
                name="scopeGrade"
                type="number"
                min={1}
                max={6}
                defaultValue={1}
                className={inputClass}
              />
            </Field>
          ) : null}
        </div>
      ) : null}

      {scope === 'class' ? (
        <Field label="학급" htmlFor="scopeClassId">
          <select id="scopeClassId" name="scopeClassId" required className={inputClass}>
            {pickableClasses.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </Field>
      ) : null}

      <Field label="종류" htmlFor="category">
        <select id="category" name="category" className={inputClass} defaultValue="class_event">
          {CATEGORIES.map((c) => (
            <option key={c.value} value={c.value}>
              {c.label}
            </option>
          ))}
        </select>
      </Field>

      <Field label="메모" htmlFor="detail" hint="장소, 준비물 등">
        <input id="detail" name="detail" maxLength={500} className={inputClass} />
      </Field>

      {state.error ? (
        <p role="alert" className="rounded-lg bg-danger-soft px-3 py-2 text-sm text-danger">
          {state.error}
        </p>
      ) : null}
      {state.ok ? (
        <p className="rounded-lg bg-ok-soft px-3 py-2 text-sm text-ok">등록했습니다</p>
      ) : null}

      <Button type="submit" disabled={pending} className="w-full">
        {pending ? '저장 중' : '등록'}
      </Button>
    </form>
  )
}
