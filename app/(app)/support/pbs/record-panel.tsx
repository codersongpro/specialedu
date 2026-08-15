'use client'

import { useState, useTransition } from 'react'
import { Button, Field, inputClass } from '@/components/ui'
import { cn } from '@/lib/cn'
import { recordBehavior, saveDetail } from './actions'

interface ClassInfo {
  id: string
  name: string
}
interface StudentInfo {
  id: string
  displayName: string
  classId: string | null
}
interface CategoryInfo {
  id: string
  name: string
}

export function RecordPanel({
  classes,
  students,
  categories,
}: {
  classes: ClassInfo[]
  students: StudentInfo[]
  categories: CategoryInfo[]
}) {
  const [classId, setClassId] = useState(classes[0]?.id ?? '')
  const [studentId, setStudentId] = useState('')
  const [pending, startTransition] = useTransition()
  const [message, setMessage] = useState<string | null>(null)

  const [lastRecordId, setLastRecordId] = useState<string | null>(null)
  const [detailOpen, setDetailOpen] = useState(false)
  const [detailPending, startDetailTransition] = useTransition()
  const [detailSaved, setDetailSaved] = useState(false)
  const [location, setLocation] = useState('')
  const [antecedent, setAntecedent] = useState('')
  const [consequence, setConsequence] = useState('')
  const [note, setNote] = useState('')

  const visibleStudents = students.filter((s) => s.classId === classId)

  function tapCategory(category: CategoryInfo) {
    if (!studentId) {
      setMessage('학생을 먼저 골라 주세요')
      return
    }
    setMessage(null)
    setDetailOpen(false)
    setDetailSaved(false)
    setLocation('')
    setAntecedent('')
    setConsequence('')
    setNote('')
    startTransition(async () => {
      const result = await recordBehavior(studentId, category.id)
      if (result.error) {
        setMessage(result.error)
        return
      }
      setLastRecordId(result.id ?? null)
      setMessage(`기록했습니다 — ${category.name}`)
    })
  }

  function saveExtraDetail() {
    if (!lastRecordId) return
    startDetailTransition(async () => {
      const result = await saveDetail(lastRecordId, { location, antecedent, consequence, note })
      if (!result.error) setDetailSaved(true)
    })
  }

  return (
    <div>
      <div className="flex flex-wrap gap-1">
        {classes.map((c) => (
          <button
            key={c.id}
            type="button"
            onClick={() => {
              setClassId(c.id)
              setStudentId('')
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
              onClick={() => setStudentId(s.id)}
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

      <p className="mt-4 text-[13px] font-semibold text-ink-soft">행동유형 — 누르면 바로 기록됩니다</p>
      <div className="mt-1.5 flex flex-wrap gap-1.5">
        {categories.map((category) => (
          <button
            key={category.id}
            type="button"
            disabled={pending}
            onClick={() => tapCategory(category)}
            className="rounded-lg border border-line bg-surface px-3 py-2 text-sm font-medium transition-colors hover:border-brand hover:bg-brand-soft hover:text-brand disabled:opacity-50"
          >
            {category.name}
          </button>
        ))}
      </div>

      {message ? <p className="mt-3 text-[13.5px] text-ok">{message}</p> : null}

      {lastRecordId ? (
        <div className="mt-3 border-t border-line pt-3">
          {!detailOpen ? (
            <button
              type="button"
              onClick={() => setDetailOpen(true)}
              className="text-[13.5px] text-brand underline"
            >
              자세히 적기 (선행사건·결과·메모)
            </button>
          ) : (
            <div className="space-y-2.5">
              <Field label="장소" htmlFor="location">
                <input
                  id="location"
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                  maxLength={60}
                  className={cn(inputClass, 'h-9 text-sm')}
                />
              </Field>
              <Field label="선행사건(A)" htmlFor="antecedent" hint="행동 직전에 무슨 일이 있었나요">
                <input
                  id="antecedent"
                  value={antecedent}
                  onChange={(e) => setAntecedent(e.target.value)}
                  maxLength={500}
                  className={cn(inputClass, 'h-9 text-sm')}
                />
              </Field>
              <Field label="결과(C)" htmlFor="consequence" hint="행동 뒤에 어떻게 대응했나요">
                <input
                  id="consequence"
                  value={consequence}
                  onChange={(e) => setConsequence(e.target.value)}
                  maxLength={500}
                  className={cn(inputClass, 'h-9 text-sm')}
                />
              </Field>
              <Field label="메모" htmlFor="note">
                <input
                  id="note"
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  maxLength={500}
                  className={cn(inputClass, 'h-9 text-sm')}
                />
              </Field>
              <div className="flex items-center gap-2">
                <Button variant="secondary" onClick={saveExtraDetail} disabled={detailPending}>
                  {detailPending ? '저장 중' : '저장'}
                </Button>
                {detailSaved ? <span className="text-[13px] text-ok">저장했습니다</span> : null}
              </div>
            </div>
          )}
        </div>
      ) : null}
    </div>
  )
}
