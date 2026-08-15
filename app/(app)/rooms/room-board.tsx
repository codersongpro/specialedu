'use client'

import { useActionState, useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Badge, Button, Card, Field, inputClass } from '@/components/ui'
import { cn } from '@/lib/cn'
import { formatKoreanDateWithDay, shiftDays, todayString } from '@/lib/date'
import { findConflicts, hasBlocking } from '@/lib/scheduling/conflicts'
import { recommendRooms } from '@/lib/scheduling/recommend'
import { formatSpan } from '@/lib/scheduling/time'
import {
  BOOKING_KIND_LABEL,
  COURSE_LABEL,
  type BookingKind,
  type Blackout,
  type ClassInfo,
  type CourseGroup,
  type CourseLevel,
  type Reservation,
  type Room,
  type ScheduleContext,
  type TimetableSlot,
} from '@/lib/scheduling/types'
import { createReservation, cancelReservation, type ReservationState } from './actions'

interface PeriodView {
  periodNo: number
  label: string
  startsMin: number
  endsMin: number
  isAfterschool: boolean
}

interface Props {
  date: string
  course: CourseLevel
  dayOfWeek: number
  rooms: Room[]
  classes: ClassInfo[]
  groups: CourseGroup[]
  teacherNames: Record<string, string>
  periods: PeriodView[]
  reservations: Reservation[]
  slots: TimetableSlot[]
  blackouts: Blackout[]
  me: { id: string; name: string; isAdmin: boolean }
}

const COURSE_TABS: CourseLevel[] = ['elementary', 'middle', 'high', 'vocational']

export function RoomBoard(props: Props) {
  const router = useRouter()
  const [picked, setPicked] = useState<{ roomId: string; periodNo: number } | null>(null)

  const ctx: ScheduleContext = useMemo(
    () => ({
      rooms: new Map(props.rooms.map((r) => [r.id, r])),
      classes: new Map(props.classes.map((c) => [c.id, c])),
      groups: new Map(props.groups.map((g) => [g.id, g])),
      teacherNames: new Map(Object.entries(props.teacherNames)),
      reservations: props.reservations,
      slots: props.slots,
      blackouts: props.blackouts,
    }),
    [props],
  )

  const activeRooms = props.rooms.filter((r) => r.isActive)

  function go(next: Partial<{ date: string; course: string }>) {
    const query = new URLSearchParams({
      date: next.date ?? props.date,
      course: next.course ?? props.course,
    })
    router.push(`/rooms?${query}`)
  }

  function reservationAt(roomId: string, period: PeriodView): Reservation | undefined {
    return props.reservations.find(
      (r) =>
        r.roomId === roomId &&
        r.reservedDate === props.date &&
        r.status !== 'cancelled' &&
        r.status !== 'rejected' &&
        r.startsMin < period.endsMin &&
        period.startsMin < r.endsMin,
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-1.5">
          <Button variant="secondary" onClick={() => go({ date: shiftDays(props.date, -1) })}>
            이전
          </Button>
          <span className="min-w-28 text-center text-sm font-medium tabular">
            {formatKoreanDateWithDay(props.date)}
          </span>
          <Button variant="secondary" onClick={() => go({ date: shiftDays(props.date, 1) })}>
            다음
          </Button>
          <Button variant="secondary" onClick={() => go({ date: todayString() })}>
            오늘
          </Button>
        </div>

        <div className="flex gap-1">
          {COURSE_TABS.map((course) => (
            <button
              key={course}
              type="button"
              onClick={() => go({ course })}
              className={cn(
                'rounded-lg px-3 py-1.5 text-sm transition-colors',
                course === props.course
                  ? 'bg-brand-soft font-medium text-brand'
                  : 'text-ink-soft hover:bg-canvas',
              )}
            >
              {COURSE_LABEL[course]}
            </button>
          ))}
        </div>
      </div>

      {props.periods.length === 0 ? (
        <Card className="p-8 text-center text-sm text-ink-soft">
          {COURSE_LABEL[props.course]} 시정표가 없습니다. 관리자 &gt; 학교 관리에서 교시를 등록하세요.
        </Card>
      ) : (
        <Card className="overflow-x-auto">
          <table className="w-full min-w-[720px] border-collapse text-sm">
            <thead>
              <tr className="border-b border-line">
                <th className="sticky left-0 z-10 bg-surface px-3 py-2.5 text-left text-xs font-semibold text-ink-soft">
                  교시
                </th>
                {activeRooms.map((room) => (
                  <th key={room.id} className="px-2 py-2.5 text-left text-xs font-semibold">
                    <span className="block truncate">{room.name}</span>
                    {room.floor != null ? (
                      <span className="font-normal text-ink-soft">{room.floor}층</span>
                    ) : null}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {props.periods.map((period) => (
                <tr key={period.periodNo} className="border-b border-line last:border-0">
                  <th className="sticky left-0 z-10 bg-surface px-3 py-2 text-left align-top">
                    <span className="block text-xs font-semibold">{period.label}</span>
                    <span className="block text-[11px] font-normal text-ink-soft tabular">
                      {formatSpan(period)}
                    </span>
                  </th>

                  {activeRooms.map((room) => {
                    const taken = reservationAt(room.id, period)
                    const isPicked =
                      picked?.roomId === room.id && picked.periodNo === period.periodNo

                    if (taken) {
                      return (
                        <td key={room.id} className="p-1 align-top">
                          <ReservedCell
                            reservation={taken}
                            ctx={ctx}
                            canCancel={props.me.isAdmin || taken.requesterId === props.me.id}
                          />
                        </td>
                      )
                    }

                    return (
                      <td key={room.id} className="p-1 align-top">
                        <button
                          type="button"
                          onClick={() => setPicked({ roomId: room.id, periodNo: period.periodNo })}
                          className={cn(
                            'h-full min-h-14 w-full rounded-lg border border-dashed border-line text-xs text-ink-soft transition-colors hover:border-brand hover:bg-brand-soft hover:text-brand',
                            isPicked && 'border-brand bg-brand-soft text-brand',
                          )}
                        >
                          비어 있음
                        </button>
                      </td>
                    )
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}

      {picked ? (
        <BookingPanel
          {...props}
          ctx={ctx}
          roomId={picked.roomId}
          periodNo={picked.periodNo}
          onClose={() => setPicked(null)}
        />
      ) : null}
    </div>
  )
}

function ReservedCell({
  reservation,
  ctx,
  canCancel,
}: {
  reservation: Reservation
  ctx: ScheduleContext
  canCancel: boolean
}) {
  const who =
    (reservation.classId && ctx.classes.get(reservation.classId)?.name) ||
    (reservation.courseGroupId && ctx.groups.get(reservation.courseGroupId)?.name) ||
    ctx.teacherNames.get(reservation.requesterId) ||
    '예약됨'

  const pending = reservation.status === 'pending'

  return (
    <div
      className={cn(
        'min-h-14 rounded-lg border p-2',
        pending ? 'border-warn/30 bg-warn-soft' : 'border-line bg-canvas',
      )}
    >
      <div className="flex items-start justify-between gap-1">
        <span className="text-xs font-medium">{who}</span>
        {pending ? <Badge tone="warn">대기</Badge> : null}
      </div>
      <p className="mt-0.5 text-[11px] text-ink-soft">
        {BOOKING_KIND_LABEL[reservation.kind]}
        {reservation.purpose ? ` · ${reservation.purpose}` : ''}
      </p>
      {canCancel ? (
        <form action={cancelReservation} className="mt-1">
          <input type="hidden" name="id" value={reservation.id} />
          <button type="submit" className="text-[11px] text-ink-soft underline hover:text-danger">
            취소
          </button>
        </form>
      ) : null}
    </div>
  )
}

function BookingPanel(
  props: Props & {
    ctx: ScheduleContext
    roomId: string
    periodNo: number
    onClose: () => void
  },
) {
  const [state, formAction, pending] = useActionState<ReservationState, FormData>(
    createReservation,
    {},
  )
  const [target, setTarget] = useState('')
  const [kind, setKind] = useState<BookingKind>('regular')

  const period = props.periods.find((p) => p.periodNo === props.periodNo)
  const room = props.rooms.find((r) => r.id === props.roomId)

  const classesForCourse = props.classes.filter((c) => c.course === props.course)
  const groupsForCourse = props.groups.filter((g) => g.course === props.course)

  const [classId, courseGroupId] = target.startsWith('g:')
    ? [null, target.slice(2)]
    : [target || null, null]

  // 화면에서 미리 보는 충돌. 서버에서 같은 함수로 다시 검사한다.
  const preview = useMemo(() => {
    if (!period || !target) return []
    return findConflicts(
      {
        roomId: props.roomId,
        reservedDate: props.date,
        dayOfWeek: props.dayOfWeek,
        course: props.course,
        periodNo: props.periodNo,
        startsMin: period.startsMin,
        endsMin: period.endsMin,
        classId,
        courseGroupId,
        requesterId: props.me.id,
        coTeacherId: null,
        kind,
      },
      props.ctx,
    )
  }, [period, target, classId, courseGroupId, kind, props])

  // 같은 시간에 쓸 수 있는 다른 방 추천
  const suggestions = useMemo(() => {
    if (!period || !target) return []
    const headcount = classId
      ? props.classes.find((c) => c.id === classId)?.studentCount
      : props.groups.find((g) => g.id === courseGroupId)?.studentCount

    return recommendRooms(
      {
        reservedDate: props.date,
        dayOfWeek: props.dayOfWeek,
        course: props.course,
        periodNo: props.periodNo,
        startsMin: period.startsMin,
        endsMin: period.endsMin,
        classId,
        courseGroupId,
        requesterId: props.me.id,
        coTeacherId: null,
        kind,
      },
      props.ctx,
      { headcount: headcount ?? undefined },
    )
      .filter((s) => s.available && s.room.id !== props.roomId)
      .slice(0, 3)
  }, [period, target, classId, courseGroupId, kind, props])

  const blocked = hasBlocking(preview)

  if (state.ok) {
    // 저장되면 서버가 다시 그려 주므로 패널만 닫는다
    queueMicrotask(props.onClose)
  }

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') props.onClose()
    }
    document.addEventListener('keydown', onKeyDown)
    const prevOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKeyDown)
      document.body.style.overflow = prevOverflow
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-ink/40 px-4 py-8 sm:items-center"
      onClick={props.onClose}
    >
      <div
        className="w-full max-w-2xl rounded-[14px] border border-line bg-surface p-5 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-start justify-between gap-3">
          <div>
            <h2 className="text-base font-semibold">
              {room?.name} · {period?.label}
            </h2>
            <p className="mt-0.5 text-sm text-ink-soft">
              {formatKoreanDateWithDay(props.date)} {period ? formatSpan(period) : ''}
            </p>
          </div>
          <Button variant="secondary" onClick={props.onClose}>
            닫기
          </Button>
        </div>

        <form action={formAction} className="grid gap-4 sm:grid-cols-2">
        <input type="hidden" name="roomId" value={props.roomId} />
        <input type="hidden" name="reservedDate" value={props.date} />
        <input type="hidden" name="course" value={props.course} />
        <input type="hidden" name="periodNo" value={props.periodNo} />
        <input type="hidden" name="classId" value={classId ?? ''} />
        <input type="hidden" name="courseGroupId" value={courseGroupId ?? ''} />

        <Field label="어느 학급인가요" htmlFor="target">
          <select
            id="target"
            value={target}
            onChange={(e) => setTarget(e.target.value)}
            required
            className={inputClass}
          >
            <option value="">고르세요</option>
            {classesForCourse.length > 0 ? (
              <optgroup label="학급">
                {classesForCourse.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name} ({c.studentCount}명)
                  </option>
                ))}
              </optgroup>
            ) : null}
            {groupsForCourse.length > 0 ? (
              <optgroup label="선택과목·주제선택">
                {groupsForCourse.map((g) => (
                  <option key={g.id} value={`g:${g.id}`}>
                    {g.name} ({g.studentCount}명)
                  </option>
                ))}
              </optgroup>
            ) : null}
          </select>
        </Field>

        <Field label="수업 형태" htmlFor="kind">
          <select
            id="kind"
            name="kind"
            value={kind}
            onChange={(e) => setKind(e.target.value as BookingKind)}
            className={inputClass}
          >
            {(Object.keys(BOOKING_KIND_LABEL) as BookingKind[]).map((k) => (
              <option key={k} value={k}>
                {BOOKING_KIND_LABEL[k]}
              </option>
            ))}
          </select>
        </Field>

        <div className="sm:col-span-2">
          <Field label="수업주제" htmlFor="purpose" hint="직접 적어 주세요. 비워 둬도 됩니다 — 학사일정 화면에도 그대로 보입니다">
            <input
              id="purpose"
              name="purpose"
              maxLength={200}
              className={inputClass}
              placeholder="예: 샌드위치 만들기"
            />
          </Field>
        </div>

        {preview.length > 0 ? (
          <div className="sm:col-span-2 space-y-1.5">
            {preview.map((conflict, i) => (
              <p
                key={`${conflict.type}-${i}`}
                className={cn(
                  'rounded-lg px-3 py-2 text-sm',
                  conflict.severity === 'block'
                    ? 'bg-danger-soft text-danger'
                    : 'bg-warn-soft text-warn',
                )}
              >
                {conflict.message}
              </p>
            ))}
          </div>
        ) : null}

        {state.error ? (
          <div className="sm:col-span-2 rounded-lg bg-danger-soft px-3 py-2 text-sm text-danger">
            <p>{state.error}</p>
            {state.conflicts?.map((message) => (
              <p key={message} className="mt-1 text-xs">
                {message}
              </p>
            ))}
          </div>
        ) : null}

        <div className="sm:col-span-2 flex items-center gap-2">
          <Button type="submit" disabled={pending || blocked || !target}>
            {pending ? '저장 중' : room?.requiresApproval ? '예약 신청' : '예약하기'}
          </Button>
          {room?.requiresApproval ? (
            <span className="text-xs text-ink-soft">승인이 필요한 특별실입니다</span>
          ) : null}
        </div>
      </form>

      {suggestions.length > 0 ? (
        <div className="mt-5 border-t border-line pt-4">
          <p className="text-xs font-semibold text-ink-soft">이 시간에 쓸 수 있는 다른 방</p>
          <ul className="mt-2 space-y-1.5">
            {suggestions.map((s) => (
              <li key={s.room.id} className="flex flex-wrap items-baseline gap-x-2 gap-y-1 text-sm">
                <span className="whitespace-nowrap font-medium">{s.room.name}</span>
                {s.reasons.length > 0 ? (
                  <span className="text-xs text-ink-soft">{s.reasons.join(' · ')}</span>
                ) : null}
              </li>
            ))}
          </ul>
        </div>
        ) : null}
      </div>
    </div>
  )
}
