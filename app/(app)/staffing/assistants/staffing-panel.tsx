'use client'

import { useMemo, useState, useTransition } from 'react'
import { Badge, Button, Field, inputClass } from '@/components/ui'
import { Modal } from '@/components/modal'
import { cn } from '@/lib/cn'
import { RealtimeRefresh } from '@/components/realtime-refresh'
import { sortClassesByCourseGrade } from '@/lib/school/class-order'
import { formatSpan } from '@/lib/scheduling/time'
import { COURSE_LABEL, type CourseLevel } from '@/lib/scheduling/types'
import type { CoverageWarning, SupportAssignment, SupportNeed } from '@/lib/staffing/coverage'
import type { AvailabilityRow } from '@/lib/data/staffing'
import {
  addNeed,
  assignStaff,
  clearAssignment,
  removeAvailability,
  removeNeed,
  saveAvailability,
} from './actions'

const DAYS = [
  { value: 1, label: '월' },
  { value: 2, label: '화' },
  { value: 3, label: '수' },
  { value: 4, label: '목' },
  { value: 5, label: '금' },
]

interface ClassOption {
  id: string
  name: string
  course: CourseLevel
  grade: number
}

interface StaffOption {
  profileId: string
  name: string
}

interface PeriodOption {
  id: string
  course: CourseLevel
  periodNo: number
  label: string
  startsMin: number
  endsMin: number
}

export function StaffingPanel({
  schoolId,
  termId,
  isAdmin,
  classes,
  staff,
  needs,
  assignments,
  warnings,
  availabilityRows,
  periods,
}: {
  schoolId: string
  termId: string
  isAdmin: boolean
  classes: ClassOption[]
  staff: StaffOption[]
  needs: SupportNeed[]
  assignments: SupportAssignment[]
  warnings: CoverageWarning[]
  availabilityRows: AvailabilityRow[]
  periods: PeriodOption[]
}) {
  const [day, setDay] = useState(1)
  const [addOpen, setAddOpen] = useState(false)
  const [availabilityOpen, setAvailabilityOpen] = useState(false)

  const staffName = useMemo(() => new Map(staff.map((s) => [s.profileId, s.name])), [staff])
  const assignedTo = useMemo(
    () => new Map(assignments.map((a) => [a.needId, a.profileId])),
    [assignments],
  )
  const warningByNeed = useMemo(() => {
    const map = new Map<string, CoverageWarning>()
    for (const w of warnings) if (!map.has(w.needId)) map.set(w.needId, w)
    return map
  }, [warnings])

  const dayNeeds = needs
    .filter((n) => n.dayOfWeek === day)
    .sort((a, b) => a.periodNo - b.periodNo)

  return (
    <div className="space-y-4">
      <RealtimeRefresh schoolId={schoolId} tables={['support_needs', 'support_assignments']} />

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex gap-1">
          {DAYS.map((d) => (
            <button
              key={d.value}
              type="button"
              onClick={() => setDay(d.value)}
              className={cn(
                'rounded-lg px-3 py-1.5 text-sm transition-colors',
                d.value === day
                  ? 'bg-brand-soft font-medium text-brand'
                  : 'text-ink-soft hover:bg-canvas',
              )}
            >
              {d.label}
            </button>
          ))}
        </div>

        {isAdmin ? (
          <div className="flex gap-2">
            <Button variant="secondary" onClick={() => setAvailabilityOpen(true)}>
              근무 시간 관리
            </Button>
            <Button onClick={() => setAddOpen(true)}>+ 지원 시간 추가</Button>
          </div>
        ) : null}
      </div>

      <div className="rounded-[14px] border border-line bg-surface">
        {dayNeeds.length === 0 ? (
          <p className="px-4 py-12 text-center text-sm text-ink-soft">
            {DAYS.find((d) => d.value === day)?.label}요일에 등록된 지원 필요 시간이 없습니다
          </p>
        ) : (
          <ul className="divide-y divide-line">
            {dayNeeds.map((need) => (
              <NeedRow
                key={need.id}
                need={need}
                isAdmin={isAdmin}
                staff={staff}
                assignedProfileId={assignedTo.get(need.id) ?? null}
                assignedName={
                  assignedTo.get(need.id) ? staffName.get(assignedTo.get(need.id)!) : undefined
                }
                warning={warningByNeed.get(need.id)}
              />
            ))}
          </ul>
        )}
      </div>

      {addOpen ? (
        <AddNeedModal
          termId={termId}
          classes={classes}
          periods={periods}
          defaultDay={day}
          onClose={() => setAddOpen(false)}
        />
      ) : null}

      {availabilityOpen ? (
        <AvailabilityModal
          staff={staff}
          availabilityRows={availabilityRows}
          onClose={() => setAvailabilityOpen(false)}
        />
      ) : null}
    </div>
  )
}

function NeedRow({
  need,
  isAdmin,
  staff,
  assignedProfileId,
  assignedName,
  warning,
}: {
  need: SupportNeed
  isAdmin: boolean
  staff: StaffOption[]
  assignedProfileId: string | null
  assignedName: string | undefined
  warning: CoverageWarning | undefined
}) {
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  function onAssign(profileId: string) {
    setError(null)
    startTransition(async () => {
      const result = profileId
        ? await assignStaff({ needId: need.id, profileId })
        : await clearAssignment(need.id)
      if (result.error) setError(result.error)
    })
  }

  function onRemoveNeed() {
    setError(null)
    startTransition(async () => {
      const result = await removeNeed(need.id)
      if (result.error) setError(result.error)
    })
  }

  return (
    <li className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-medium">{need.className}</span>
          <span className="text-sm text-ink-soft tabular">
            {need.periodNo}교시 · {formatSpan(need)}
          </span>
          {warning ? (
            <Badge tone={warning.kind === 'double_booked' ? 'danger' : 'warn'}>
              {warning.kind === 'double_booked'
                ? '중복'
                : warning.kind === 'outside_hours'
                  ? '근무시간 아님'
                  : '공백'}
            </Badge>
          ) : null}
        </div>
        {warning ? <p className="mt-0.5 text-[13px] text-ink-soft">{warning.message}</p> : null}
        {error ? <p className="mt-0.5 text-[13px] text-danger">{error}</p> : null}
      </div>

      {isAdmin ? (
        <div className="flex shrink-0 items-center gap-2">
          <select
            value={assignedProfileId ?? ''}
            onChange={(e) => onAssign(e.target.value)}
            disabled={pending}
            className={cn(inputClass, 'h-9 w-40')}
          >
            <option value="">미배정</option>
            {staff.map((s) => (
              <option key={s.profileId} value={s.profileId}>
                {s.name}
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={onRemoveNeed}
            disabled={pending}
            className="text-[13px] text-ink-soft underline hover:text-danger"
          >
            삭제
          </button>
        </div>
      ) : (
        <span className="shrink-0 text-sm">{assignedName ?? '미배정'}</span>
      )}
    </li>
  )
}

function AddNeedModal({
  termId,
  classes,
  periods,
  defaultDay,
  onClose,
}: {
  termId: string
  classes: ClassOption[]
  periods: PeriodOption[]
  defaultDay: number
  onClose: () => void
}) {
  const sorted = useMemo(() => sortClassesByCourseGrade(classes), [classes])
  const [classId, setClassId] = useState(sorted[0]?.id ?? '')
  const [dayOfWeek, setDayOfWeek] = useState(defaultDay)
  const [note, setNote] = useState('')
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  const selectedClass = sorted.find((c) => c.id === classId)
  const coursePeriods = periods
    .filter((p) => p.course === selectedClass?.course)
    .sort((a, b) => a.periodNo - b.periodNo)
  const [periodNo, setPeriodNo] = useState(coursePeriods[0]?.periodNo ?? 1)

  function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!selectedClass) return
    setError(null)
    startTransition(async () => {
      const result = await addNeed({
        termId,
        classId: selectedClass.id,
        course: selectedClass.course,
        dayOfWeek,
        periodNo,
        note: note || undefined,
      })
      if (result.error) setError(result.error)
      else onClose()
    })
  }

  return (
    <Modal open onClose={onClose} title="지원 필요 시간 추가">
      <form onSubmit={onSubmit} className="space-y-3">
        <Field label="학급" htmlFor="staffing-class">
          <select
            id="staffing-class"
            value={classId}
            onChange={(e) => {
              setClassId(e.target.value)
              const next = sorted.find((c) => c.id === e.target.value)
              const nextPeriods = periods
                .filter((p) => p.course === next?.course)
                .sort((a, b) => a.periodNo - b.periodNo)
              setPeriodNo(nextPeriods[0]?.periodNo ?? 1)
            }}
            className={inputClass}
          >
            {(['elementary', 'middle', 'high', 'vocational'] as CourseLevel[]).map((course) => {
              const group = sorted.filter((c) => c.course === course)
              if (group.length === 0) return null
              return (
                <optgroup key={course} label={COURSE_LABEL[course]}>
                  {group.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </optgroup>
              )
            })}
          </select>
        </Field>

        <Field label="요일" htmlFor="staffing-day">
          <select
            id="staffing-day"
            value={dayOfWeek}
            onChange={(e) => setDayOfWeek(Number(e.target.value))}
            className={inputClass}
          >
            {DAYS.map((d) => (
              <option key={d.value} value={d.value}>
                {d.label}요일
              </option>
            ))}
          </select>
        </Field>

        <Field label="교시" htmlFor="staffing-period">
          {coursePeriods.length === 0 ? (
            <p className="text-sm text-danger">
              {selectedClass ? COURSE_LABEL[selectedClass.course] : ''} 시정표가 없습니다. 학교
              관리에서 먼저 등록하세요.
            </p>
          ) : (
            <select
              id="staffing-period"
              value={periodNo}
              onChange={(e) => setPeriodNo(Number(e.target.value))}
              className={inputClass}
            >
              {coursePeriods.map((p) => (
                <option key={p.id} value={p.periodNo}>
                  {p.periodNo}교시 · {p.label} ({formatSpan({ startsMin: p.startsMin, endsMin: p.endsMin })})
                </option>
              ))}
            </select>
          )}
        </Field>

        <Field label="메모 (선택)" htmlFor="staffing-note">
          <input
            id="staffing-note"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            maxLength={200}
            className={inputClass}
            placeholder="예: 이동수업 동행"
          />
        </Field>

        {error ? <p className="text-sm text-danger">{error}</p> : null}

        <Button type="submit" disabled={pending || coursePeriods.length === 0} className="w-full">
          {pending ? '저장 중' : '추가'}
        </Button>
      </form>
    </Modal>
  )
}

function AvailabilityModal({
  staff,
  availabilityRows,
  onClose,
}: {
  staff: StaffOption[]
  availabilityRows: AvailabilityRow[]
  onClose: () => void
}) {
  const [profileId, setProfileId] = useState(staff[0]?.profileId ?? '')
  const [dayOfWeek, setDayOfWeek] = useState(1)
  const [startsAt, setStartsAt] = useState('09:00')
  const [endsAt, setEndsAt] = useState('13:00')
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  const byStaff = useMemo(() => {
    const map = new Map<string, AvailabilityRow[]>()
    for (const row of availabilityRows) {
      const list = map.get(row.profileId) ?? []
      list.push(row)
      map.set(row.profileId, list)
    }
    return map
  }, [availabilityRows])

  function onAdd(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    startTransition(async () => {
      const result = await saveAvailability({ profileId, dayOfWeek, startsAt, endsAt })
      if (result.error) setError(result.error)
    })
  }

  function onRemove(id: string) {
    startTransition(async () => {
      await removeAvailability(id)
    })
  }

  return (
    <Modal open onClose={onClose} title="근무 시간 관리" maxWidthClassName="max-w-lg">
      <div className="space-y-4">
        <form onSubmit={onAdd} className="space-y-3 rounded-lg border border-line p-3">
          <Field label="보조인력" htmlFor="avail-staff">
            <select
              id="avail-staff"
              value={profileId}
              onChange={(e) => setProfileId(e.target.value)}
              className={inputClass}
            >
              {staff.map((s) => (
                <option key={s.profileId} value={s.profileId}>
                  {s.name}
                </option>
              ))}
            </select>
          </Field>
          <div className="grid grid-cols-3 gap-2">
            <Field label="요일" htmlFor="avail-day">
              <select
                id="avail-day"
                value={dayOfWeek}
                onChange={(e) => setDayOfWeek(Number(e.target.value))}
                className={inputClass}
              >
                {DAYS.map((d) => (
                  <option key={d.value} value={d.value}>
                    {d.label}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="시작" htmlFor="avail-start">
              <input
                id="avail-start"
                type="time"
                value={startsAt}
                onChange={(e) => setStartsAt(e.target.value)}
                className={inputClass}
              />
            </Field>
            <Field label="종료" htmlFor="avail-end">
              <input
                id="avail-end"
                type="time"
                value={endsAt}
                onChange={(e) => setEndsAt(e.target.value)}
                className={inputClass}
              />
            </Field>
          </div>
          {error ? <p className="text-sm text-danger">{error}</p> : null}
          <Button type="submit" disabled={pending || !profileId} className="w-full">
            {pending ? '저장 중' : '근무 시간 추가'}
          </Button>
        </form>

        <div className="space-y-3">
          {staff.map((s) => {
            const rows = (byStaff.get(s.profileId) ?? []).sort(
              (a, b) => a.dayOfWeek - b.dayOfWeek || a.startsMin - b.startsMin,
            )
            return (
              <div key={s.profileId}>
                <p className="text-sm font-medium">{s.name}</p>
                {rows.length === 0 ? (
                  <p className="text-[13px] text-ink-soft">등록된 근무 시간이 없습니다</p>
                ) : (
                  <ul className="mt-1 flex flex-wrap gap-1.5">
                    {rows.map((row) => (
                      <li key={row.id}>
                        <button
                          type="button"
                          onClick={() => onRemove(row.id)}
                          disabled={pending}
                          className="rounded-md bg-canvas px-2 py-1 text-[13px] text-ink-soft hover:bg-danger-soft hover:text-danger"
                          title="눌러서 지우기"
                        >
                          {DAYS.find((d) => d.value === row.dayOfWeek)?.label}{' '}
                          {formatSpan({ startsMin: row.startsMin, endsMin: row.endsMin })} ✕
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )
          })}
        </div>
      </div>
    </Modal>
  )
}
