import { formatSpan, overlaps } from './time'
import type {
  BookingRequest,
  Conflict,
  Reservation,
  ScheduleContext,
  TimetableSlot,
} from './types'

/**
 * 특별실 예약 충돌 검사.
 *
 * severity 가 'block' 이면 저장을 막고, 'warn' 이면 경고만 띄운다.
 * DB 에도 EXCLUDE 제약이 걸려 있지만, 그건 특별실 중복 하나만 막는다.
 * 교사·학급 중복은 여러 테이블에 걸쳐 있어 여기서 잡아야 한다.
 */
export function findConflicts(req: BookingRequest, ctx: ScheduleContext): Conflict[] {
  const conflicts: Conflict[] = []
  const span = { startsMin: req.startsMin, endsMin: req.endsMin }

  const room = ctx.rooms.get(req.roomId)
  if (room && !room.isActive) {
    conflicts.push({
      type: 'room_inactive',
      severity: 'block',
      message: `${room.name}은 지금 쓸 수 없는 상태입니다`,
    })
  }

  // --- 특별실 중복 -----------------------------------------------------------
  for (const other of ctx.reservations) {
    if (other.id === req.reservationId) continue
    if (other.roomId !== req.roomId) continue
    if (other.reservedDate !== req.reservedDate) continue
    if (other.status === 'cancelled' || other.status === 'rejected') continue
    if (!overlaps(span, other)) continue

    const who = describeUser(other, ctx)
    conflicts.push({
      type: 'room_taken',
      severity: 'block',
      message: `${formatSpan(other)} ${who} 사용 중`,
      withId: other.id,
    })
  }

  // --- 사용 불가 구간 --------------------------------------------------------
  for (const blackout of ctx.blackouts) {
    if (blackout.roomId !== req.roomId) continue
    if (req.reservedDate < blackout.startsOn || req.reservedDate > blackout.endsOn) continue
    if (!overlaps(span, blackout)) continue
    conflicts.push({
      type: 'room_blackout',
      severity: 'block',
      message: `${blackout.reason}으로 막아둔 시간입니다`,
      withId: blackout.id,
    })
  }

  // --- 교사 중복 -------------------------------------------------------------
  // 예약을 넣은 사람과 협력강사 모두, 그 시각에 다른 데 묶여 있으면 안 된다.
  const people: Array<{ id: string; type: 'teacher_busy' | 'co_teacher_busy'; label: string }> = [
    { id: req.requesterId, type: 'teacher_busy', label: '' },
  ]
  if (req.coTeacherId) {
    people.push({ id: req.coTeacherId, type: 'co_teacher_busy', label: '협력강사 ' })
  }

  for (const person of people) {
    const name = ctx.teacherNames.get(person.id) ?? '해당 교사'

    for (const slot of ctx.slots) {
      if (slot.dayOfWeek !== req.dayOfWeek) continue
      if (slot.teacherId !== person.id && slot.coTeacherId !== person.id) continue
      if (!overlaps(span, slot)) continue
      // 지금 예약하려는 그 수업 자체는 충돌이 아니다.
      if (isSameLesson(slot, req)) continue
      conflicts.push({
        type: person.type,
        severity: 'block',
        message: `${person.label}${name} 선생님은 이 시간에 ${describeSlotTarget(slot, ctx)} 수업이 있습니다`,
        withId: slot.id,
      })
    }

    for (const other of ctx.reservations) {
      if (other.id === req.reservationId) continue
      if (other.status === 'cancelled' || other.status === 'rejected') continue
      if (other.requesterId !== person.id && other.coTeacherId !== person.id) continue
      if (!overlaps(span, other)) continue
      conflicts.push({
        type: person.type,
        severity: 'block',
        message: `${person.label}${name} 선생님은 이 시간에 ${roomName(other.roomId, ctx)} 예약이 있습니다`,
        withId: other.id,
      })
    }
  }

  // --- 학급 · 수강그룹 중복 --------------------------------------------------
  // 수강그룹은 여러 학급에서 학생이 모이므로, 그룹을 잡으면 소속 학급도 함께 묶인다.
  const occupiedClassIds = expandToClassIds(req.classId, req.courseGroupId, ctx)

  if (occupiedClassIds.size > 0) {
    // 정규 시간표는 경고만 한다 — 막지 않는다. isSameLesson()이 잡아내는 건
    // "같은 교시·같은 교사"뿐이라, 교과전담·협력수업처럼 그 교시를 다른
    // 교사가 맡는 경우엔 exemption을 못 타 학급이 자기 자신과 충돌하는
    // 것처럼 보고돼 정작 특별실로 옮기려는 정상적인 예약까지 막혔다.
    // 반면 특별실끼리의 진짜 중복(아래 reservations 루프)은 여전히 막는다.
    for (const slot of ctx.slots) {
      if (slot.dayOfWeek !== req.dayOfWeek) continue
      if (!overlaps(span, slot)) continue
      if (isSameLesson(slot, req)) continue
      const slotClassIds = expandToClassIds(slot.classId, slot.courseGroupId, ctx)
      const clash = intersect(occupiedClassIds, slotClassIds)
      if (clash.length === 0) continue
      conflicts.push({
        type: req.courseGroupId ? 'group_busy' : 'class_busy',
        severity: 'warn',
        message: `${classNames(clash, ctx)}은 이 시간에 ${describeSlotTarget(slot, ctx)} 수업 중입니다`,
        withId: slot.id,
      })
    }

    for (const other of ctx.reservations) {
      if (other.id === req.reservationId) continue
      if (other.status === 'cancelled' || other.status === 'rejected') continue
      if (!overlaps(span, other)) continue
      const otherClassIds = expandToClassIds(other.classId, other.courseGroupId, ctx)
      const clash = intersect(occupiedClassIds, otherClassIds)
      if (clash.length === 0) continue
      conflicts.push({
        type: req.courseGroupId ? 'group_busy' : 'class_busy',
        severity: 'block',
        message: `${classNames(clash, ctx)}은 이 시간에 ${roomName(other.roomId, ctx)}을 씁니다`,
        withId: other.id,
      })
    }
  }

  return dedupe(conflicts)
}

export function hasBlocking(conflicts: readonly Conflict[]): boolean {
  return conflicts.some((c) => c.severity === 'block')
}

// -----------------------------------------------------------------------------
// 보조 함수
// -----------------------------------------------------------------------------

/**
 * 수강그룹은 소속 학급들을 함께 점유한다.
 * 고교학점제 선택과목에 3-1, 3-2 학생이 섞여 있으면 그 시간 두 학급 모두 묶인다.
 */
function expandToClassIds(
  classId: string | null,
  groupId: string | null,
  ctx: ScheduleContext,
): Set<string> {
  const ids = new Set<string>()
  if (classId) ids.add(classId)
  if (groupId) {
    const group = ctx.groups.get(groupId)
    if (group) for (const id of group.memberClassIds) ids.add(id)
  }
  return ids
}

function intersect(a: Set<string>, b: Set<string>): string[] {
  const out: string[] = []
  for (const id of a) if (b.has(id)) out.push(id)
  return out
}

/**
 * 같은 수업을 특별실로 옮기는 것뿐이면 충돌로 보지 않는다.
 *
 * 단, 그 수업을 맡은 교사가 직접 예약할 때만 그렇다.
 * 다른 교사가 같은 학급을 같은 시각에 잡으면 학생이 두 곳에 있어야 하므로
 * 명백한 충돌이다 — 학급·교시만 보고 넘기면 이 경우를 놓친다.
 */
function isSameLesson(slot: TimetableSlot, req: BookingRequest): boolean {
  if (slot.course !== req.course || slot.periodNo !== req.periodNo) return false

  const sameTarget =
    (req.classId != null && slot.classId === req.classId) ||
    (req.courseGroupId != null && slot.courseGroupId === req.courseGroupId)
  if (!sameTarget) return false

  return slot.teacherId === req.requesterId || slot.coTeacherId === req.requesterId
}

function describeSlotTarget(slot: TimetableSlot, ctx: ScheduleContext): string {
  if (slot.classId) return classNames([slot.classId], ctx)
  if (slot.courseGroupId) return ctx.groups.get(slot.courseGroupId)?.name ?? '선택과목'
  return '다른'
}

function describeUser(reservation: Reservation, ctx: ScheduleContext): string {
  if (reservation.classId) return classNames([reservation.classId], ctx)
  if (reservation.courseGroupId) {
    return ctx.groups.get(reservation.courseGroupId)?.name ?? '선택과목'
  }
  return ctx.teacherNames.get(reservation.requesterId) ?? '다른 선생님'
}

function classNames(ids: readonly string[], ctx: ScheduleContext): string {
  const names = ids.map((id) => ctx.classes.get(id)?.name ?? '학급')
  if (names.length <= 2) return names.join(', ')
  return `${names.slice(0, 2).join(', ')} 외 ${names.length - 2}개 학급`
}

function roomName(roomId: string, ctx: ScheduleContext): string {
  return ctx.rooms.get(roomId)?.name ?? '특별실'
}

/** 같은 원인이 여러 경로로 잡히면 한 줄만 남긴다 */
function dedupe(conflicts: readonly Conflict[]): Conflict[] {
  const seen = new Set<string>()
  const out: Conflict[] = []
  for (const c of conflicts) {
    const key = `${c.type}:${c.withId ?? ''}:${c.message}`
    if (seen.has(key)) continue
    seen.add(key)
    out.push(c)
  }
  return out
}
