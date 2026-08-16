'use client'

import { useState, useTransition } from 'react'
import { Button, EmptyState, Field, inputClass } from '@/components/ui'
import { cn } from '@/lib/cn'
import {
  deleteClass,
  deleteDepartment,
  deleteRoom,
  deleteStudent,
  deleteSubject,
  saveClass,
  saveDepartment,
  saveRoom,
  saveStudent,
  saveSubject,
  toggleRoomActive,
  toggleStudentActive,
} from './actions'
import { TimetableImportPanel } from './timetable-import-panel'

interface StaffOption {
  id: string
  name: string
}
interface DepartmentRow {
  id: string
  name: string
  headId: string | null
}
interface SubjectRow {
  id: string
  name: string
}
interface ClassRow {
  id: string
  course: string
  grade: number
  name: string
  homeroomTeacherId: string | null
  assistantTeacherId: string | null
  studentCount: number
}
interface RoomRow {
  id: string
  name: string
  roomType: string
  floor: number | null
  capacity: number | null
  features: string[]
  managedBy: string | null
  requiresApproval: boolean
  isActive: boolean
}
interface StudentRow {
  id: string
  classId: string | null
  studentCode: string
  displayName: string
  isActive: boolean
}

const TABS = ['부서', '교과', '학급', '특별실', '학생', '시간표 업로드'] as const
type Tab = (typeof TABS)[number]

const COURSES = [
  { value: 'elementary', label: '초등' },
  { value: 'middle', label: '중학' },
  { value: 'high', label: '고등' },
  { value: 'vocational', label: '전공과' },
]
const COURSE_LABEL: Record<string, string> = Object.fromEntries(COURSES.map((c) => [c.value, c.label]))

export function DataTabs({
  staff,
  departments,
  subjects,
  classes,
  rooms,
  students,
}: {
  staff: StaffOption[]
  departments: DepartmentRow[]
  subjects: SubjectRow[]
  classes: ClassRow[]
  rooms: RoomRow[]
  students: StudentRow[]
}) {
  const [tab, setTab] = useState<Tab>('학급')

  return (
    <div>
      <div className="flex flex-wrap gap-1 border-b border-line pb-3">
        {TABS.map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setTab(t)}
            className={cn(
              'rounded-lg px-3 py-1.5 text-sm transition-colors',
              t === tab ? 'bg-brand-soft font-medium text-brand' : 'text-ink-soft hover:bg-canvas',
            )}
          >
            {t}
          </button>
        ))}
      </div>

      <div className="pt-4">
        {tab === '부서' ? <DepartmentPanel rows={departments} staff={staff} /> : null}
        {tab === '교과' ? <SubjectPanel rows={subjects} /> : null}
        {tab === '학급' ? <ClassPanel rows={classes} staff={staff} /> : null}
        {tab === '특별실' ? <RoomPanel rows={rooms} departments={departments} /> : null}
        {tab === '학생' ? <StudentPanel rows={students} classes={classes} /> : null}
        {tab === '시간표 업로드' ? (
          <TimetableImportPanel classNames={classes.map((c) => c.name)} />
        ) : null}
      </div>
    </div>
  )
}

function staffLabel(staff: StaffOption[], id: string | null): string {
  if (!id) return '—'
  return staff.find((s) => s.id === id)?.name ?? '—'
}

// --- 부서 -------------------------------------------------------------------
function DepartmentPanel({ rows, staff }: { rows: DepartmentRow[]; staff: StaffOption[] }) {
  const [editingId, setEditingId] = useState<string | null>(null)
  const [name, setName] = useState('')
  const [headId, setHeadId] = useState('')
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  function edit(row: DepartmentRow) {
    setEditingId(row.id)
    setName(row.name)
    setHeadId(row.headId ?? '')
  }
  function reset() {
    setEditingId(null)
    setName('')
    setHeadId('')
    setError(null)
  }
  function submit() {
    startTransition(async () => {
      const result = await saveDepartment(editingId, { name, headId: headId || null })
      if (result.error) setError(result.error)
      else reset()
    })
  }
  function remove(id: string) {
    startTransition(async () => {
      await deleteDepartment(id)
    })
  }

  return (
    <div>
      <div className="flex flex-wrap items-end gap-2">
        <Field label="이름" htmlFor="dept-name">
          <input id="dept-name" value={name} onChange={(e) => setName(e.target.value)} className={cn(inputClass, 'w-40')} />
        </Field>
        <Field label="부서장" htmlFor="dept-head" hint="선택 사항">
          <select id="dept-head" value={headId} onChange={(e) => setHeadId(e.target.value)} className={cn(inputClass, 'w-40')}>
            <option value="">없음</option>
            {staff.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </Field>
        <Button onClick={submit} disabled={pending || !name.trim()}>
          {editingId ? '수정 저장' : '추가'}
        </Button>
        {editingId ? (
          <Button variant="secondary" onClick={reset}>
            취소
          </Button>
        ) : null}
      </div>
      {error ? <p className="mt-2 text-[13.5px] text-danger">{error}</p> : null}

      <ul className="mt-4 divide-y divide-line">
        {rows.length === 0 ? <EmptyState title="등록된 부서가 없습니다" /> : null}
        {rows.map((row) => (
          <li key={row.id} className="flex flex-wrap items-center gap-3 py-2 text-[15px]">
            <span className="font-medium">{row.name}</span>
            <span className="text-[13.5px] text-ink-soft">부서장: {staffLabel(staff, row.headId)}</span>
            <div className="ml-auto flex gap-2">
              <button type="button" onClick={() => edit(row)} className="text-[13.5px] text-brand underline">
                수정
              </button>
              <button type="button" onClick={() => remove(row.id)} className="text-[13.5px] text-ink-soft underline hover:text-danger">
                삭제
              </button>
            </div>
          </li>
        ))}
      </ul>
    </div>
  )
}

// --- 교과 -------------------------------------------------------------------
function SubjectPanel({ rows }: { rows: SubjectRow[] }) {
  const [editingId, setEditingId] = useState<string | null>(null)
  const [name, setName] = useState('')
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  function reset() {
    setEditingId(null)
    setName('')
    setError(null)
  }
  function submit() {
    startTransition(async () => {
      const result = await saveSubject(editingId, { name })
      if (result.error) setError(result.error)
      else reset()
    })
  }
  function remove(id: string) {
    startTransition(async () => {
      await deleteSubject(id)
    })
  }

  return (
    <div>
      <div className="flex flex-wrap items-end gap-2">
        <Field label="이름" htmlFor="subject-name">
          <input id="subject-name" value={name} onChange={(e) => setName(e.target.value)} className={cn(inputClass, 'w-40')} />
        </Field>
        <Button onClick={submit} disabled={pending || !name.trim()}>
          {editingId ? '수정 저장' : '추가'}
        </Button>
        {editingId ? (
          <Button variant="secondary" onClick={reset}>
            취소
          </Button>
        ) : null}
      </div>
      {error ? <p className="mt-2 text-[13.5px] text-danger">{error}</p> : null}

      <ul className="mt-4 flex flex-wrap gap-2">
        {rows.length === 0 ? <EmptyState title="등록된 교과가 없습니다" /> : null}
        {rows.map((row) => (
          <li key={row.id} className="flex items-center gap-1.5 rounded-lg border border-line px-3 py-1.5 text-[14px]">
            {row.name}
            <button
              type="button"
              onClick={() => {
                setEditingId(row.id)
                setName(row.name)
              }}
              className="text-brand underline"
            >
              수정
            </button>
            <button type="button" onClick={() => remove(row.id)} className="text-ink-soft underline hover:text-danger">
              삭제
            </button>
          </li>
        ))}
      </ul>
    </div>
  )
}

// --- 학급 -------------------------------------------------------------------
function ClassPanel({ rows, staff }: { rows: ClassRow[]; staff: StaffOption[] }) {
  const [editingId, setEditingId] = useState<string | null>(null)
  const [course, setCourse] = useState('elementary')
  const [grade, setGrade] = useState(1)
  const [name, setName] = useState('')
  const [homeroomTeacherId, setHomeroomTeacherId] = useState('')
  const [assistantTeacherId, setAssistantTeacherId] = useState('')
  const [studentCount, setStudentCount] = useState(0)
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  function edit(row: ClassRow) {
    setEditingId(row.id)
    setCourse(row.course)
    setGrade(row.grade)
    setName(row.name)
    setHomeroomTeacherId(row.homeroomTeacherId ?? '')
    setAssistantTeacherId(row.assistantTeacherId ?? '')
    setStudentCount(row.studentCount)
  }
  function reset() {
    setEditingId(null)
    setCourse('elementary')
    setGrade(1)
    setName('')
    setHomeroomTeacherId('')
    setAssistantTeacherId('')
    setStudentCount(0)
    setError(null)
  }
  function submit() {
    startTransition(async () => {
      const result = await saveClass(editingId, {
        course: course as never,
        grade,
        name,
        homeroomTeacherId: homeroomTeacherId || null,
        assistantTeacherId: assistantTeacherId || null,
        studentCount,
      })
      if (result.error) setError(result.error)
      else reset()
    })
  }
  function remove(id: string) {
    startTransition(async () => {
      const result = await deleteClass(id)
      if (result.error) setError(result.error)
    })
  }

  return (
    <div>
      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
        <Field label="과정" htmlFor="class-course">
          <select id="class-course" value={course} onChange={(e) => setCourse(e.target.value)} className={inputClass}>
            {COURSES.map((c) => (
              <option key={c.value} value={c.value}>
                {c.label}
              </option>
            ))}
          </select>
        </Field>
        <Field label="학년" htmlFor="class-grade">
          <input
            id="class-grade"
            type="number"
            min={1}
            max={6}
            value={grade}
            onChange={(e) => setGrade(Number(e.target.value))}
            className={inputClass}
          />
        </Field>
        <Field label="이름" htmlFor="class-name" hint="예: 고3-1">
          <input id="class-name" value={name} onChange={(e) => setName(e.target.value)} className={inputClass} />
        </Field>
        <Field label="담임" htmlFor="class-homeroom" hint="선택 사항">
          <select
            id="class-homeroom"
            value={homeroomTeacherId}
            onChange={(e) => setHomeroomTeacherId(e.target.value)}
            className={inputClass}
          >
            <option value="">없음</option>
            {staff.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </Field>
        <Field label="부담임" htmlFor="class-assistant" hint="선택 사항">
          <select
            id="class-assistant"
            value={assistantTeacherId}
            onChange={(e) => setAssistantTeacherId(e.target.value)}
            className={inputClass}
          >
            <option value="">없음</option>
            {staff.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </Field>
        <Field label="학생 수" htmlFor="class-count" hint="특별실 추천 계산에 쓰입니다">
          <input
            id="class-count"
            type="number"
            min={0}
            max={60}
            value={studentCount}
            onChange={(e) => setStudentCount(Number(e.target.value))}
            className={inputClass}
          />
        </Field>
      </div>

      <div className="mt-2 flex gap-2">
        <Button onClick={submit} disabled={pending || !name.trim()}>
          {editingId ? '수정 저장' : '추가'}
        </Button>
        {editingId ? (
          <Button variant="secondary" onClick={reset}>
            취소
          </Button>
        ) : null}
      </div>
      {error ? <p className="mt-2 text-[13.5px] text-danger">{error}</p> : null}

      <ul className="mt-4 divide-y divide-line">
        {rows.length === 0 ? <EmptyState title="등록된 학급이 없습니다" /> : null}
        {rows.map((row) => (
          <li key={row.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 py-2 text-[15px]">
            <span className="whitespace-nowrap font-medium">{row.name}</span>
            <span className="whitespace-nowrap text-[13.5px] text-ink-soft">
              {COURSE_LABEL[row.course]} {row.grade}학년
            </span>
            <span className="whitespace-nowrap text-[13.5px] text-ink-soft">
              담임 {staffLabel(staff, row.homeroomTeacherId)}
            </span>
            <span className="whitespace-nowrap text-[13.5px] text-ink-soft">학생 {row.studentCount}명</span>
            <div className="ml-auto flex gap-2">
              <button type="button" onClick={() => edit(row)} className="text-[13.5px] text-brand underline">
                수정
              </button>
              <button type="button" onClick={() => remove(row.id)} className="text-[13.5px] text-ink-soft underline hover:text-danger">
                삭제
              </button>
            </div>
          </li>
        ))}
      </ul>
    </div>
  )
}

// --- 특별실 -----------------------------------------------------------------
function RoomPanel({ rows, departments }: { rows: RoomRow[]; departments: DepartmentRow[] }) {
  const [editingId, setEditingId] = useState<string | null>(null)
  const [name, setName] = useState('')
  const [roomType, setRoomType] = useState('general')
  const [floor, setFloor] = useState('')
  const [capacity, setCapacity] = useState('')
  const [featuresText, setFeaturesText] = useState('')
  const [managedBy, setManagedBy] = useState('')
  const [requiresApproval, setRequiresApproval] = useState(false)
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  function edit(row: RoomRow) {
    setEditingId(row.id)
    setName(row.name)
    setRoomType(row.roomType)
    setFloor(row.floor?.toString() ?? '')
    setCapacity(row.capacity?.toString() ?? '')
    setFeaturesText(row.features.join(', '))
    setManagedBy(row.managedBy ?? '')
    setRequiresApproval(row.requiresApproval)
  }
  function reset() {
    setEditingId(null)
    setName('')
    setRoomType('general')
    setFloor('')
    setCapacity('')
    setFeaturesText('')
    setManagedBy('')
    setRequiresApproval(false)
    setError(null)
  }
  function submit() {
    startTransition(async () => {
      const result = await saveRoom(editingId, {
        name,
        roomType,
        floor: floor ? Number(floor) : undefined,
        capacity: capacity ? Number(capacity) : undefined,
        features: featuresText
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean),
        managedBy: managedBy || null,
        requiresApproval,
      })
      if (result.error) setError(result.error)
      else reset()
    })
  }
  function remove(id: string) {
    startTransition(async () => {
      const result = await deleteRoom(id)
      if (result.error) setError(result.error)
    })
  }

  return (
    <div>
      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
        <Field label="이름" htmlFor="room-name">
          <input id="room-name" value={name} onChange={(e) => setName(e.target.value)} className={inputClass} />
        </Field>
        <Field label="용도" htmlFor="room-type" hint="예: cooking, gym, therapy">
          <input id="room-type" value={roomType} onChange={(e) => setRoomType(e.target.value)} className={inputClass} />
        </Field>
        <Field label="층" htmlFor="room-floor" hint="선택 사항">
          <input id="room-floor" type="number" value={floor} onChange={(e) => setFloor(e.target.value)} className={inputClass} />
        </Field>
        <Field label="정원" htmlFor="room-capacity" hint="선택 사항">
          <input
            id="room-capacity"
            type="number"
            value={capacity}
            onChange={(e) => setCapacity(e.target.value)}
            className={inputClass}
          />
        </Field>
        <Field label="관리 부서" htmlFor="room-managed" hint="선택 사항">
          <select id="room-managed" value={managedBy} onChange={(e) => setManagedBy(e.target.value)} className={inputClass}>
            <option value="">없음</option>
            {departments.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name}
              </option>
            ))}
          </select>
        </Field>
        <Field label="특징" htmlFor="room-features" hint="쉼표로 구분">
          <input
            id="room-features"
            value={featuresText}
            onChange={(e) => setFeaturesText(e.target.value)}
            placeholder="예: 싱크대, 인덕션"
            className={inputClass}
          />
        </Field>
      </div>

      <label className="mt-2 flex items-center gap-1.5 text-[14px]">
        <input type="checkbox" checked={requiresApproval} onChange={(e) => setRequiresApproval(e.target.checked)} />
        예약에 승인이 필요함
      </label>

      <div className="mt-2 flex gap-2">
        <Button onClick={submit} disabled={pending || !name.trim()}>
          {editingId ? '수정 저장' : '추가'}
        </Button>
        {editingId ? (
          <Button variant="secondary" onClick={reset}>
            취소
          </Button>
        ) : null}
      </div>
      {error ? <p className="mt-2 text-[13.5px] text-danger">{error}</p> : null}

      <ul className="mt-4 divide-y divide-line">
        {rows.length === 0 ? <EmptyState title="등록된 특별실이 없습니다" /> : null}
        {rows.map((row) => (
          <li key={row.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 py-2 text-[15px]">
            <span className={cn('whitespace-nowrap font-medium', !row.isActive && 'text-ink-soft line-through')}>
              {row.name}
            </span>
            <span className="whitespace-nowrap text-[13.5px] text-ink-soft">{row.roomType}</span>
            {row.requiresApproval ? <span className="whitespace-nowrap text-[13.5px] text-warn">승인 필요</span> : null}
            <div className="ml-auto flex gap-2">
              <button
                type="button"
                onClick={() => startTransition(() => toggleRoomActive(row.id, !row.isActive))}
                className="text-[13.5px] text-ink-soft underline"
              >
                {row.isActive ? '사용 중지' : '다시 사용'}
              </button>
              <button type="button" onClick={() => edit(row)} className="text-[13.5px] text-brand underline">
                수정
              </button>
              <button type="button" onClick={() => remove(row.id)} className="text-[13.5px] text-ink-soft underline hover:text-danger">
                삭제
              </button>
            </div>
          </li>
        ))}
      </ul>
    </div>
  )
}

// --- 학생(가명) ---------------------------------------------------------------
function StudentPanel({ rows, classes }: { rows: StudentRow[]; classes: ClassRow[] }) {
  const [editingId, setEditingId] = useState<string | null>(null)
  const [classId, setClassId] = useState(classes[0]?.id ?? '')
  const [studentCode, setStudentCode] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  function edit(row: StudentRow) {
    setEditingId(row.id)
    setClassId(row.classId ?? '')
    setStudentCode(row.studentCode)
    setDisplayName(row.displayName)
  }
  function reset() {
    setEditingId(null)
    setClassId(classes[0]?.id ?? '')
    setStudentCode('')
    setDisplayName('')
    setError(null)
  }
  function submit() {
    startTransition(async () => {
      const result = await saveStudent(editingId, { classId, studentCode, displayName })
      if (result.error) setError(result.error)
      else reset()
    })
  }
  function remove(id: string) {
    startTransition(async () => {
      const result = await deleteStudent(id)
      if (result.error) setError(result.error)
    })
  }

  const className = (id: string | null) => classes.find((c) => c.id === id)?.name ?? '—'

  return (
    <div>
      <p className="mb-3 rounded-lg bg-warn-soft px-3 py-2 text-[13.5px] text-warn">
        실명·생년월일·연락처는 절대 넣지 마세요. 학번과 별칭(예: &ldquo;고3-1 1번&rdquo;)만 등록합니다.
      </p>

      {classes.length === 0 ? (
        <EmptyState title="학급을 먼저 만들어 주세요" hint="학급 탭에서 학급을 추가하면 여기서 배정할 수 있습니다" />
      ) : (
        <>
          <div className="grid gap-2 sm:grid-cols-3">
            <Field label="학급" htmlFor="student-class">
              <select id="student-class" value={classId} onChange={(e) => setClassId(e.target.value)} className={inputClass}>
                {classes.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="학번" htmlFor="student-code">
              <input id="student-code" value={studentCode} onChange={(e) => setStudentCode(e.target.value)} className={inputClass} />
            </Field>
            <Field label="별칭" htmlFor="student-name" hint="실명 대신 이니셜·번호 등">
              <input
                id="student-name"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                className={inputClass}
              />
            </Field>
          </div>

          <div className="mt-2 flex gap-2">
            <Button onClick={submit} disabled={pending || !studentCode.trim() || !displayName.trim()}>
              {editingId ? '수정 저장' : '추가'}
            </Button>
            {editingId ? (
              <Button variant="secondary" onClick={reset}>
                취소
              </Button>
            ) : null}
          </div>
          {error ? <p className="mt-2 text-[13.5px] text-danger">{error}</p> : null}
        </>
      )}

      <ul className="mt-4 divide-y divide-line">
        {rows.length === 0 ? <EmptyState title="등록된 학생이 없습니다" /> : null}
        {rows.map((row) => (
          <li key={row.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 py-2 text-[15px]">
            <span className={cn('whitespace-nowrap font-medium', !row.isActive && 'text-ink-soft line-through')}>
              {row.displayName}
            </span>
            <span className="whitespace-nowrap text-[13.5px] text-ink-soft">{row.studentCode}</span>
            <span className="whitespace-nowrap text-[13.5px] text-ink-soft">{className(row.classId)}</span>
            <div className="ml-auto flex gap-2">
              <button
                type="button"
                onClick={() => startTransition(() => toggleStudentActive(row.id, !row.isActive))}
                className="text-[13.5px] text-ink-soft underline"
              >
                {row.isActive ? '사용 중지' : '다시 사용'}
              </button>
              <button type="button" onClick={() => edit(row)} className="text-[13.5px] text-brand underline">
                수정
              </button>
              <button type="button" onClick={() => remove(row.id)} className="text-[13.5px] text-ink-soft underline hover:text-danger">
                삭제
              </button>
            </div>
          </li>
        ))}
      </ul>
    </div>
  )
}
