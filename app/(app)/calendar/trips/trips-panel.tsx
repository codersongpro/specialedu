'use client'

import { useMemo, useState, useTransition } from 'react'
import { Badge, Button, Field, inputClass } from '@/components/ui'
import { Modal } from '@/components/modal'
import { RealtimeRefresh } from '@/components/realtime-refresh'
import { cn } from '@/lib/cn'
import { todayString } from '@/lib/date'
import { sortClassesByCourseGrade } from '@/lib/school/class-order'
import { COURSE_LABEL, type CourseLevel } from '@/lib/scheduling/types'
import type { ChaperoneInfo, ChecklistItemInfo, FieldTripInfo } from '@/lib/data/field-trips'
import {
  addChaperone,
  addChecklistItem,
  createTrip,
  deleteTrip,
  removeChaperone,
  removeChecklistItem,
  toggleChecklistItem,
} from './actions'

const SCOPE_OPTIONS = [
  { value: 'school', label: '전교' },
  { value: 'course', label: '과정' },
  { value: 'grade', label: '학년' },
  { value: 'class', label: '학급' },
  { value: 'department', label: '부서' },
] as const

const SCOPE_LABEL: Record<string, string> = {
  school: '전교',
  course: '과정',
  grade: '학년',
  class: '학급',
  department: '부서',
}

interface ClassOption {
  id: string
  name: string
  course: CourseLevel
  grade: number
}

function scopeText(
  trip: FieldTripInfo,
  classNames: Map<string, string>,
  departmentNames: Map<string, string>,
): string {
  if (trip.scope === 'class') return (trip.scopeClassId && classNames.get(trip.scopeClassId)) || '학급'
  if (trip.scope === 'department')
    return (trip.scopeDepartmentId && departmentNames.get(trip.scopeDepartmentId)) || '부서'
  if (trip.scope === 'grade') return `${COURSE_LABEL[trip.scopeCourse as CourseLevel] ?? ''} ${trip.scopeGrade}학년`
  if (trip.scope === 'course') return COURSE_LABEL[trip.scopeCourse as CourseLevel] ?? '과정'
  return SCOPE_LABEL[trip.scope] ?? trip.scope
}

export function TripsPanel({
  schoolId,
  myProfileId,
  isAdmin,
  trips,
  checklist,
  chaperones,
  classes,
  departments,
  staff,
}: {
  schoolId: string
  myProfileId: string
  isAdmin: boolean
  trips: FieldTripInfo[]
  checklist: ChecklistItemInfo[]
  chaperones: ChaperoneInfo[]
  classes: ClassOption[]
  departments: Array<{ id: string; name: string }>
  staff: Array<{ id: string; name: string }>
}) {
  const [addOpen, setAddOpen] = useState(false)
  const [expanded, setExpanded] = useState<string | null>(null)

  const classNames = useMemo(() => new Map(classes.map((c) => [c.id, c.name])), [classes])
  const departmentNames = useMemo(() => new Map(departments.map((d) => [d.id, d.name])), [departments])

  const checklistByTrip = useMemo(() => {
    const map = new Map<string, ChecklistItemInfo[]>()
    for (const item of checklist) {
      const list = map.get(item.tripId) ?? []
      list.push(item)
      map.set(item.tripId, list)
    }
    return map
  }, [checklist])

  const chaperonesByTrip = useMemo(() => {
    const map = new Map<string, ChaperoneInfo[]>()
    for (const c of chaperones) {
      const list = map.get(c.tripId) ?? []
      list.push(c)
      map.set(c.tripId, list)
    }
    return map
  }, [chaperones])

  return (
    <div>
      <RealtimeRefresh
        schoolId={schoolId}
        tables={['field_trips', 'field_trip_checklist_items', 'field_trip_chaperones']}
      />

      <div className="mb-3 flex justify-end">
        <Button onClick={() => setAddOpen(true)}>+ 체험학습 등록</Button>
      </div>

      {trips.length === 0 ? null : (
        <ul className="space-y-2">
          {trips.map((trip) => {
            const open = expanded === trip.id
            const tripChecklist = checklistByTrip.get(trip.id) ?? []
            const tripChaperones = chaperonesByTrip.get(trip.id) ?? []
            const doneCount = tripChecklist.filter((c) => c.isChecked).length
            const canManage = isAdmin || trip.createdBy === myProfileId

            return (
              <li key={trip.id} className="rounded-[14px] border border-line">
                <button
                  type="button"
                  onClick={() => setExpanded(open ? null : trip.id)}
                  className="flex w-full flex-wrap items-center gap-2 px-4 py-3 text-left"
                >
                  <span className="rounded bg-canvas px-1.5 py-0.5 text-xs font-medium text-ink-soft">
                    {scopeText(trip, classNames, departmentNames)}
                  </span>
                  <span className="whitespace-nowrap text-[15px] font-medium">{trip.title}</span>
                  <span className="whitespace-nowrap text-[13px] text-ink-soft tabular">
                    {trip.startsOn === trip.endsOn ? trip.startsOn : `${trip.startsOn} ~ ${trip.endsOn}`}
                  </span>
                  <Badge tone={tripChaperones.length === 0 ? 'warn' : 'ok'}>
                    인솔자 {tripChaperones.length === 0 ? '미배정' : `${tripChaperones.length}명`}
                  </Badge>
                  {tripChecklist.length > 0 ? (
                    <Badge tone={doneCount === tripChecklist.length ? 'ok' : 'neutral'}>
                      체크 {doneCount}/{tripChecklist.length}
                    </Badge>
                  ) : null}
                </button>

                {open ? (
                  <TripDetail
                    trip={trip}
                    checklist={tripChecklist}
                    chaperones={tripChaperones}
                    staff={staff}
                    canManage={canManage}
                    onClosed={() => setExpanded(null)}
                  />
                ) : null}
              </li>
            )
          })}
        </ul>
      )}

      {addOpen ? (
        <CreateTripModal classes={classes} departments={departments} onClose={() => setAddOpen(false)} />
      ) : null}
    </div>
  )
}

function TripDetail({
  trip,
  checklist,
  chaperones,
  staff,
  canManage,
  onClosed,
}: {
  trip: FieldTripInfo
  checklist: ChecklistItemInfo[]
  chaperones: ChaperoneInfo[]
  staff: Array<{ id: string; name: string }>
  canManage: boolean
  onClosed: () => void
}) {
  const [newLabel, setNewLabel] = useState('')
  const [chaperonePick, setChaperonePick] = useState(staff[0]?.id ?? '')
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  const assignedIds = new Set(chaperones.map((c) => c.profileId))
  const available = staff.filter((s) => !assignedIds.has(s.id))

  function onAddChecklist(e: React.FormEvent) {
    e.preventDefault()
    if (!newLabel.trim()) return
    startTransition(async () => {
      const result = await addChecklistItem(trip.id, newLabel)
      if (result.error) setError(result.error)
      else setNewLabel('')
    })
  }

  function onAddChaperone() {
    if (!chaperonePick) return
    startTransition(async () => {
      const result = await addChaperone(trip.id, chaperonePick)
      if (result.error) setError(result.error)
    })
  }

  function onDeleteTrip() {
    startTransition(async () => {
      const result = await deleteTrip(trip.id)
      if (result.error) setError(result.error)
      else onClosed()
    })
  }

  return (
    <div className="space-y-4 border-t border-line px-4 py-3">
      {trip.destination ? <p className="text-[14px]">장소: {trip.destination}</p> : null}
      {trip.contactNote ? (
        <p className="text-[14px] text-ink-soft">비상연락: {trip.contactNote}</p>
      ) : null}

      <div>
        <p className="mb-1.5 text-[13px] font-semibold text-ink-soft">안전 점검 체크리스트</p>
        {checklist.length === 0 ? (
          <p className="text-[13px] text-ink-soft">등록된 항목이 없습니다</p>
        ) : (
          <ul className="space-y-1">
            {checklist.map((item) => (
              <ChecklistRow key={item.id} item={item} canManage={canManage} />
            ))}
          </ul>
        )}
        {canManage ? (
          <form onSubmit={onAddChecklist} className="mt-2 flex gap-2">
            <input
              value={newLabel}
              onChange={(e) => setNewLabel(e.target.value)}
              placeholder="예: 보험 가입 확인"
              maxLength={120}
              className={cn(inputClass, 'h-9')}
            />
            <Button type="submit" variant="secondary" disabled={pending || !newLabel.trim()}>
              추가
            </Button>
          </form>
        ) : null}
      </div>

      <div>
        <p className="mb-1.5 text-[13px] font-semibold text-ink-soft">인솔 배치</p>
        {chaperones.length === 0 ? (
          <p className="text-[13px] text-ink-soft">배정된 인솔자가 없습니다</p>
        ) : (
          <ul className="flex flex-wrap gap-1.5">
            {chaperones.map((c) => (
              <li key={c.id}>
                <span className="inline-flex items-center gap-1 rounded-md bg-canvas px-2 py-1 text-[13px]">
                  {c.profileName}
                  {canManage ? (
                    <button
                      type="button"
                      disabled={pending}
                      onClick={() =>
                        startTransition(async () => {
                          const result = await removeChaperone(c.id)
                          if (result.error) setError(result.error)
                        })
                      }
                      className="text-ink-soft hover:text-danger"
                      title="눌러서 해제"
                    >
                      ✕
                    </button>
                  ) : null}
                </span>
              </li>
            ))}
          </ul>
        )}
        {canManage && available.length > 0 ? (
          <div className="mt-2 flex gap-2">
            <select
              value={chaperonePick}
              onChange={(e) => setChaperonePick(e.target.value)}
              className={cn(inputClass, 'h-9 w-40')}
            >
              {available.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
            <Button variant="secondary" disabled={pending} onClick={onAddChaperone}>
              배정
            </Button>
          </div>
        ) : null}
      </div>

      {error ? <p className="text-[13px] text-danger">{error}</p> : null}

      {canManage ? (
        <button
          type="button"
          disabled={pending}
          onClick={onDeleteTrip}
          className="text-[12.5px] text-ink-soft underline hover:text-danger"
        >
          이 체험학습 삭제
        </button>
      ) : null}
    </div>
  )
}

function ChecklistRow({ item, canManage }: { item: ChecklistItemInfo; canManage: boolean }) {
  const [pending, startTransition] = useTransition()

  return (
    <li className="flex items-center gap-2 text-[14px]">
      <input
        type="checkbox"
        checked={item.isChecked}
        disabled={pending || !canManage}
        onChange={(e) => startTransition(() => void toggleChecklistItem(item.id, e.target.checked))}
        className="h-4 w-4"
      />
      <span className={item.isChecked ? 'text-ink-soft line-through' : ''}>{item.label}</span>
      {canManage ? (
        <button
          type="button"
          disabled={pending}
          onClick={() => startTransition(() => void removeChecklistItem(item.id))}
          className="text-[12px] text-ink-soft underline hover:text-danger"
        >
          삭제
        </button>
      ) : null}
    </li>
  )
}

function CreateTripModal({
  classes,
  departments,
  onClose,
}: {
  classes: ClassOption[]
  departments: Array<{ id: string; name: string }>
  onClose: () => void
}) {
  const today = todayString()
  const sortedClasses = useMemo(() => sortClassesByCourseGrade(classes), [classes])

  const [title, setTitle] = useState('')
  const [destination, setDestination] = useState('')
  const [startsOn, setStartsOn] = useState(today)
  const [endsOn, setEndsOn] = useState(today)
  const [scope, setScope] = useState<(typeof SCOPE_OPTIONS)[number]['value']>('class')
  const [scopeCourse, setScopeCourse] = useState<CourseLevel>('elementary')
  const [scopeGrade, setScopeGrade] = useState(1)
  const [scopeClassId, setScopeClassId] = useState(sortedClasses[0]?.id ?? '')
  const [scopeDepartmentId, setScopeDepartmentId] = useState(departments[0]?.id ?? '')
  const [contactNote, setContactNote] = useState('')
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    startTransition(async () => {
      const result = await createTrip({
        title,
        destination: destination || undefined,
        startsOn,
        endsOn,
        scope,
        scopeCourse: scope === 'course' || scope === 'grade' ? scopeCourse : undefined,
        scopeGrade: scope === 'grade' ? scopeGrade : undefined,
        scopeClassId: scope === 'class' ? scopeClassId : undefined,
        scopeDepartmentId: scope === 'department' ? scopeDepartmentId : undefined,
        contactNote: contactNote || undefined,
      })
      if (result.error) setError(result.error)
      else onClose()
    })
  }

  return (
    <Modal open onClose={onClose} title="현장체험학습 등록" maxWidthClassName="max-w-lg">
      <form onSubmit={onSubmit} className="space-y-3">
        <Field label="이름" htmlFor="trip-title">
          <input
            id="trip-title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            required
            maxLength={120}
            className={inputClass}
            placeholder="예: 초등부 가을 현장체험학습"
          />
        </Field>

        <Field label="장소 (선택)" htmlFor="trip-destination">
          <input
            id="trip-destination"
            value={destination}
            onChange={(e) => setDestination(e.target.value)}
            maxLength={120}
            className={inputClass}
          />
        </Field>

        <div className="grid grid-cols-2 gap-2">
          <Field label="시작일" htmlFor="trip-starts">
            <input
              id="trip-starts"
              type="date"
              value={startsOn}
              onChange={(e) => setStartsOn(e.target.value)}
              className={inputClass}
            />
          </Field>
          <Field label="종료일" htmlFor="trip-ends">
            <input
              id="trip-ends"
              type="date"
              value={endsOn}
              min={startsOn}
              onChange={(e) => setEndsOn(e.target.value)}
              className={inputClass}
            />
          </Field>
        </div>

        <Field label="대상 범위" htmlFor="trip-scope">
          <select
            id="trip-scope"
            value={scope}
            onChange={(e) => setScope(e.target.value as (typeof SCOPE_OPTIONS)[number]['value'])}
            className={inputClass}
          >
            {SCOPE_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </Field>

        {scope === 'course' || scope === 'grade' ? (
          <div className="grid grid-cols-2 gap-2">
            <Field label="과정" htmlFor="trip-course">
              <select
                id="trip-course"
                value={scopeCourse}
                onChange={(e) => setScopeCourse(e.target.value as CourseLevel)}
                className={inputClass}
              >
                {(['elementary', 'middle', 'high', 'vocational'] as CourseLevel[]).map((c) => (
                  <option key={c} value={c}>
                    {COURSE_LABEL[c]}
                  </option>
                ))}
              </select>
            </Field>
            {scope === 'grade' ? (
              <Field label="학년" htmlFor="trip-grade">
                <input
                  id="trip-grade"
                  type="number"
                  min={1}
                  max={6}
                  value={scopeGrade}
                  onChange={(e) => setScopeGrade(Number(e.target.value))}
                  className={inputClass}
                />
              </Field>
            ) : null}
          </div>
        ) : null}

        {scope === 'class' ? (
          <Field label="학급" htmlFor="trip-class">
            {sortedClasses.length === 0 ? (
              <p className="text-sm text-danger">등록된 학급이 없습니다</p>
            ) : (
              <select
                id="trip-class"
                value={scopeClassId}
                onChange={(e) => setScopeClassId(e.target.value)}
                className={inputClass}
              >
                {(['elementary', 'middle', 'high', 'vocational'] as CourseLevel[]).map((course) => {
                  const group = sortedClasses.filter((c) => c.course === course)
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
            )}
          </Field>
        ) : null}

        {scope === 'department' ? (
          <Field label="부서" htmlFor="trip-department">
            {departments.length === 0 ? (
              <p className="text-sm text-danger">등록된 부서가 없습니다</p>
            ) : (
              <select
                id="trip-department"
                value={scopeDepartmentId}
                onChange={(e) => setScopeDepartmentId(e.target.value)}
                className={inputClass}
              >
                {departments.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name}
                  </option>
                ))}
              </select>
            )}
          </Field>
        ) : null}

        <Field
          label="비상연락 안내 (선택)"
          htmlFor="trip-contact"
          hint="학생 연락처는 저장하지 않습니다 — 담임을 거치는 절차를 적어 두세요"
        >
          <input
            id="trip-contact"
            value={contactNote}
            onChange={(e) => setContactNote(e.target.value)}
            maxLength={300}
            className={inputClass}
            placeholder="예: 인솔 담임을 통해 학부모에게 연락"
          />
        </Field>

        {error ? <p className="text-sm text-danger">{error}</p> : null}

        <Button type="submit" disabled={pending} className="w-full">
          {pending ? '저장 중' : '등록'}
        </Button>
      </form>
    </Modal>
  )
}
