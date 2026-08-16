import type { Reservation, ScheduleContext } from './types'

export function reservationLabels(reservation: Reservation, ctx: ScheduleContext) {
  const requester = ctx.teacherNames.get(reservation.requesterId) ?? '알 수 없음'
  const target =
    (reservation.classId && ctx.classes.get(reservation.classId)?.name) ||
    (reservation.courseGroupId && ctx.groups.get(reservation.courseGroupId)?.name) ||
    requester

  return { target, requester }
}
