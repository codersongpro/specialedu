'use client'

import { useState, useTransition } from 'react'
import { Button, EmptyState, Field, inputClass } from '@/components/ui'
import { cn } from '@/lib/cn'
import type { IepArea } from '@/lib/supabase/database.types'
import { createGoal } from './actions'
import { GoalCard, type GoalItem } from './goal-card'
import { AREA_LABEL } from './labels'

export type { GoalItem } from './goal-card'

export interface ClassInfo {
  id: string
  name: string
}
export interface StudentInfo {
  id: string
  displayName: string
  classId: string | null
}

export function GoalPanel({
  classes,
  students,
  goals,
}: {
  classes: ClassInfo[]
  students: StudentInfo[]
  goals: GoalItem[]
}) {
  const [classId, setClassId] = useState(classes[0]?.id ?? '')
  const [studentId, setStudentId] = useState('')
  const [formOpen, setFormOpen] = useState(false)

  const visibleStudents = students.filter((s) => s.classId === classId)
  const studentGoals = goals
    .filter((g) => g.studentId === studentId)
    .sort((a, b) => (a.status === b.status ? 0 : a.status === 'active' ? -1 : 1))

  return (
    <div>
      <div className="rounded-[14px] border border-line bg-surface p-5">
        <h2 className="text-sm font-semibold">학생 고르기</h2>
        <div className="mt-3 flex flex-wrap gap-1">
          {classes.map((c) => (
            <button
              key={c.id}
              type="button"
              onClick={() => {
                setClassId(c.id)
                setStudentId('')
                setFormOpen(false)
              }}
              className={cn(
                'rounded-lg px-3 py-1.5 text-sm transition-colors',
                c.id === classId ? 'bg-brand-soft font-medium text-brand' : 'text-ink-soft hover:bg-canvas',
              )}
            >
              {c.name}
            </button>
          ))}
        </div>

        <div className="mt-3 flex flex-wrap gap-1.5">
          {visibleStudents.length === 0 ? (
            <p className="text-sm text-ink-soft">이 학급에 등록된 학생이 없습니다</p>
          ) : (
            visibleStudents.map((s) => (
              <button
                key={s.id}
                type="button"
                onClick={() => {
                  setStudentId(s.id)
                  setFormOpen(false)
                }}
                className={cn(
                  'rounded-lg border px-3 py-1.5 text-sm transition-colors',
                  s.id === studentId
                    ? 'border-brand bg-brand-soft font-medium text-brand'
                    : 'border-line text-ink hover:bg-canvas',
                )}
              >
                {s.displayName}
              </button>
            ))
          )}
        </div>
      </div>

      {!studentId ? (
        <div className="mt-4">
          <EmptyState title="학생을 골라 주세요" hint="위에서 학급과 학생을 고르면 목표가 나타납니다" />
        </div>
      ) : (
        <div className="mt-4 rounded-[14px] border border-line bg-surface p-5">
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-sm font-semibold">목표</h2>
            <Button variant="secondary" className="h-8 px-3 text-[13px]" onClick={() => setFormOpen((v) => !v)}>
              {formOpen ? '닫기' : '목표 추가'}
            </Button>
          </div>

          {formOpen ? <GoalForm studentId={studentId} onDone={() => setFormOpen(false)} /> : null}

          <ul className="mt-3 space-y-2">
            {studentGoals.length === 0 ? (
              <EmptyState title="등록된 목표가 없습니다" hint="위 목표 추가 버튼으로 첫 목표를 세워 보세요" />
            ) : (
              studentGoals.map((goal) => <GoalCard key={goal.id} goal={goal} />)
            )}
          </ul>
        </div>
      )}
    </div>
  )
}

function GoalForm({ studentId, onDone }: { studentId: string; onDone: () => void }) {
  const [area, setArea] = useState<IepArea>('self_care')
  const [title, setTitle] = useState('')
  const [termLabel, setTermLabel] = useState('')
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  function submit() {
    startTransition(async () => {
      const result = await createGoal({ studentId, area, title, termLabel })
      if (result.error) {
        setError(result.error)
        return
      }
      setTitle('')
      setTermLabel('')
      onDone()
    })
  }

  return (
    <div className="mt-3 space-y-2.5 rounded-lg bg-canvas p-3">
      <Field label="영역" htmlFor="goal-area">
        <select
          id="goal-area"
          value={area}
          onChange={(e) => setArea(e.target.value as IepArea)}
          className={inputClass}
        >
          {(Object.keys(AREA_LABEL) as IepArea[]).map((a) => (
            <option key={a} value={a}>
              {AREA_LABEL[a]}
            </option>
          ))}
        </select>
      </Field>
      <Field label="목표" htmlFor="goal-title" hint="예: 손 씻기를 독립적으로 수행한다">
        <input
          id="goal-title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          maxLength={200}
          className={inputClass}
        />
      </Field>
      <Field label="학기" htmlFor="goal-term" hint="예: 2026학년도 2학기">
        <input
          id="goal-term"
          value={termLabel}
          onChange={(e) => setTermLabel(e.target.value)}
          maxLength={40}
          className={inputClass}
        />
      </Field>
      {error ? <p className="text-[13.5px] text-danger">{error}</p> : null}
      <Button onClick={submit} disabled={pending || !title.trim() || !termLabel.trim()} className="w-full">
        {pending ? '저장 중' : '저장'}
      </Button>
    </div>
  )
}
