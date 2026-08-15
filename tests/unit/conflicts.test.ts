import { describe, expect, it } from 'vitest'
import { findConflicts, hasBlocking } from '@/lib/scheduling/conflicts'
import { bookingRequest, makeContext, period, reservation, slot } from './fixtures'

describe('과정별 시정 차이', () => {
  /**
   * 이 앱에서 가장 위험한 버그가 여기 있다.
   * 초등 3교시는 10:40~11:20, 고등 3교시는 11:00~11:50 이라 교시 번호는 같지만
   * 실제로는 20분 겹친다. 교시 번호로 비교하는 구현은 이 예약을 통과시킨다.
   */
  it('교시 번호가 같아도 시각이 다르면 각각 판정한다', () => {
    const e3 = period('elementary', 3)
    const h3 = period('high', 3)
    expect(e3.startsMin).not.toBe(h3.startsMin)
    // 10:40~11:20 과 11:00~11:50 은 겹친다
    expect(e3.endsMin).toBeGreaterThan(h3.startsMin)
  })

  it('초등 3교시 예약이 있으면 고등 3교시 예약을 막는다', () => {
    const ctx = makeContext({
      reservations: [
        reservation({
          roomId: 'room-cook',
          course: 'elementary',
          periodNo: 3,
          classId: 'cls-e3',
        }),
      ],
    })

    const req = bookingRequest({
      roomId: 'room-cook',
      course: 'high',
      periodNo: 3,
      classId: 'cls-h3a',
      requesterId: 't-lee',
    })

    const conflicts = findConflicts(req, ctx)
    expect(hasBlocking(conflicts)).toBe(true)
    expect(conflicts.some((c) => c.type === 'room_taken')).toBe(true)
  })

  it('실제로 겹치지 않는 교시는 통과시킨다', () => {
    // 초등 1교시 09:00~09:40 / 고등 2교시 10:00~10:50 — 겹치지 않는다
    const ctx = makeContext({
      reservations: [
        reservation({ roomId: 'room-cook', course: 'elementary', periodNo: 1, classId: 'cls-e3' }),
      ],
    })

    const conflicts = findConflicts(
      bookingRequest({ roomId: 'room-cook', course: 'high', periodNo: 2, classId: 'cls-h3a', requesterId: 't-lee' }),
      ctx,
    )
    expect(hasBlocking(conflicts)).toBe(false)
  })

  it('전공과 블록타임은 초등 두 교시를 함께 막는다', () => {
    // 전공과 1블록 09:00~10:40 은 초등 1교시(09:00~09:40)와 2교시(09:50~10:30)에 모두 걸린다
    const ctx = makeContext({
      reservations: [
        reservation({
          roomId: 'room-barista',
          course: 'vocational',
          periodNo: 1,
          classId: 'cls-v1',
        }),
      ],
    })

    for (const periodNo of [1, 2]) {
      const conflicts = findConflicts(
        bookingRequest({ roomId: 'room-barista', course: 'elementary', periodNo, classId: 'cls-e3', requesterId: 't-lee' }),
        ctx,
      )
      expect(hasBlocking(conflicts), `초등 ${periodNo}교시`).toBe(true)
    }
  })
})

describe('특별실 중복', () => {
  it('승인된 예약은 저장을 막고, 대기 중 예약은 경고만 한다', () => {
    const pending = makeContext({
      reservations: [
        reservation({ roomId: 'room-gym', course: 'high', periodNo: 2, status: 'pending', classId: 'cls-h3b' }),
      ],
    })
    const conflicts = findConflicts(
      bookingRequest({ roomId: 'room-gym', course: 'high', periodNo: 2, classId: 'cls-h3a', requesterId: 't-lee' }),
      pending,
    )
    expect(hasBlocking(conflicts)).toBe(false)
    expect(conflicts.some((c) => c.type === 'room_pending')).toBe(true)
  })

  it('취소·반려된 예약은 무시한다', () => {
    const ctx = makeContext({
      reservations: [
        reservation({ roomId: 'room-gym', course: 'high', periodNo: 2, status: 'cancelled' }),
        reservation({ roomId: 'room-gym', course: 'high', periodNo: 2, status: 'rejected' }),
      ],
    })
    const conflicts = findConflicts(
      bookingRequest({ roomId: 'room-gym', course: 'high', periodNo: 2, classId: 'cls-h3a' }),
      ctx,
    )
    expect(conflicts).toHaveLength(0)
  })

  it('자기 자신을 수정할 때는 충돌로 보지 않는다', () => {
    const existing = reservation({ roomId: 'room-gym', course: 'high', periodNo: 2, classId: 'cls-h3a' })
    const ctx = makeContext({ reservations: [existing] })

    const conflicts = findConflicts(
      bookingRequest({
        reservationId: existing.id,
        roomId: 'room-gym',
        course: 'high',
        periodNo: 2,
        classId: 'cls-h3a',
      }),
      ctx,
    )
    expect(hasBlocking(conflicts)).toBe(false)
  })

  it('사용 중지된 특별실은 예약할 수 없다', () => {
    const conflicts = findConflicts(
      bookingRequest({ roomId: 'room-closed', course: 'high', periodNo: 1, classId: 'cls-h3a' }),
      makeContext(),
    )
    expect(conflicts.some((c) => c.type === 'room_inactive')).toBe(true)
  })
})

describe('교사 중복', () => {
  it('정규 수업이 있는 시간에는 다른 특별실을 예약할 수 없다', () => {
    const ctx = makeContext({
      slots: [slot({ course: 'high', periodNo: 2, teacherId: 't-kim', classId: 'cls-h3b', dayOfWeek: 1 })],
    })

    const conflicts = findConflicts(
      bookingRequest({ roomId: 'room-gym', course: 'high', periodNo: 2, classId: 'cls-h3a', requesterId: 't-kim' }),
      ctx,
    )
    expect(conflicts.some((c) => c.type === 'teacher_busy')).toBe(true)
    expect(conflicts[0]?.message).toContain('김하늘')
  })

  it('같은 수업을 특별실로 옮기는 것은 충돌이 아니다', () => {
    const ctx = makeContext({
      slots: [slot({ course: 'high', periodNo: 2, teacherId: 't-kim', classId: 'cls-h3a', dayOfWeek: 1 })],
    })

    const conflicts = findConflicts(
      bookingRequest({ roomId: 'room-gym', course: 'high', periodNo: 2, classId: 'cls-h3a', requesterId: 't-kim' }),
      ctx,
    )
    expect(hasBlocking(conflicts)).toBe(false)
  })

  it('협력강사가 다른 곳에 묶여 있으면 막는다', () => {
    const ctx = makeContext({
      slots: [slot({ course: 'high', periodNo: 2, teacherId: 't-park', classId: 'cls-h3b', dayOfWeek: 1 })],
    })

    const conflicts = findConflicts(
      bookingRequest({
        roomId: 'room-gym',
        course: 'high',
        periodNo: 2,
        classId: 'cls-h3a',
        requesterId: 't-kim',
        coTeacherId: 't-park',
        kind: 'co_teaching',
      }),
      ctx,
    )
    expect(conflicts.some((c) => c.type === 'co_teacher_busy')).toBe(true)
    expect(conflicts.some((c) => c.message.includes('협력강사'))).toBe(true)
  })

  it('다른 요일 수업은 영향을 주지 않는다', () => {
    const ctx = makeContext({
      slots: [slot({ course: 'high', periodNo: 2, teacherId: 't-kim', classId: 'cls-h3b', dayOfWeek: 3 })],
    })

    const conflicts = findConflicts(
      bookingRequest({ roomId: 'room-gym', course: 'high', periodNo: 2, classId: 'cls-h3a', requesterId: 't-kim', dayOfWeek: 1 }),
      ctx,
    )
    expect(hasBlocking(conflicts)).toBe(false)
  })
})

describe('학급 · 수강그룹 중복', () => {
  it('학급이 이미 다른 수업 중이면 막는다', () => {
    const ctx = makeContext({
      slots: [slot({ course: 'high', periodNo: 2, teacherId: 't-lee', classId: 'cls-h3a', dayOfWeek: 1 })],
    })

    const conflicts = findConflicts(
      bookingRequest({ roomId: 'room-gym', course: 'high', periodNo: 2, classId: 'cls-h3a', requesterId: 't-kim' }),
      ctx,
    )
    expect(conflicts.some((c) => c.type === 'class_busy')).toBe(true)
  })

  /**
   * 고교학점제 선택과목은 여러 학급에서 학생이 모인다.
   * 그룹을 잡으면 소속 학급 학생들이 다 묶이므로, 그 학급의 다른 수업과 충돌한다.
   */
  it('수강그룹을 잡으면 소속 학급도 함께 점유된다', () => {
    const ctx = makeContext({
      slots: [slot({ course: 'high', periodNo: 3, teacherId: 't-lee', classId: 'cls-h3b', dayOfWeek: 1 })],
    })

    const conflicts = findConflicts(
      bookingRequest({
        roomId: 'room-barista',
        course: 'high',
        periodNo: 3,
        courseGroupId: 'grp-barista',
        requesterId: 't-kim',
      }),
      ctx,
    )
    expect(conflicts.some((c) => c.type === 'group_busy')).toBe(true)
    expect(conflicts.some((c) => c.message.includes('고3-2'))).toBe(true)
  })

  it('반대로 학급 수업이 그룹 수업과도 충돌한다', () => {
    const ctx = makeContext({
      slots: [slot({ course: 'high', periodNo: 3, teacherId: 't-lee', courseGroupId: 'grp-barista', dayOfWeek: 1 })],
    })

    const conflicts = findConflicts(
      bookingRequest({ roomId: 'room-gym', course: 'high', periodNo: 3, classId: 'cls-h3a', requesterId: 't-kim' }),
      ctx,
    )
    expect(conflicts.some((c) => c.type === 'class_busy')).toBe(true)
  })
})

describe('사용 불가 구간', () => {
  it('점검 기간에는 예약을 막는다', () => {
    const ctx = makeContext({
      blackouts: [
        {
          id: 'bo-1',
          roomId: 'room-gym',
          startsOn: '2026-03-09',
          endsOn: '2026-03-13',
          startsMin: 0,
          endsMin: 1440,
          reason: '바닥 공사',
        },
      ],
    })

    const conflicts = findConflicts(
      bookingRequest({ roomId: 'room-gym', course: 'high', periodNo: 1, classId: 'cls-h3a' }),
      ctx,
    )
    expect(conflicts.some((c) => c.type === 'room_blackout')).toBe(true)
    expect(conflicts.some((c) => c.message.includes('바닥 공사'))).toBe(true)
  })

  it('기간 밖 날짜는 영향받지 않는다', () => {
    const ctx = makeContext({
      blackouts: [
        {
          id: 'bo-1',
          roomId: 'room-gym',
          startsOn: '2026-03-16',
          endsOn: '2026-03-20',
          startsMin: 0,
          endsMin: 1440,
          reason: '바닥 공사',
        },
      ],
    })

    const conflicts = findConflicts(
      bookingRequest({ roomId: 'room-gym', course: 'high', periodNo: 1, classId: 'cls-h3a', reservedDate: '2026-03-09' }),
      ctx,
    )
    expect(hasBlocking(conflicts)).toBe(false)
  })
})
