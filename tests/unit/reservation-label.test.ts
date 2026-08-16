import { describe, expect, it } from 'vitest'
import { reservationLabels } from '@/lib/scheduling/reservation-label'
import { makeContext, reservation } from './fixtures'

describe('특별실 예약 표시', () => {
  it('학급 예약에도 예약한 교직원 이름을 함께 표시한다', () => {
    const labels = reservationLabels(
      reservation({ course: 'high', periodNo: 1, roomId: 'room-gym', classId: 'cls-h3a', requesterId: 't-kim' }),
      makeContext(),
    )

    expect(labels.target).toBe('고3-1')
    expect(labels.requester).toBe('김하늘')
  })

  it('대상이 없으면 예약자 이름을 예약 대상으로 사용한다', () => {
    const labels = reservationLabels(
      reservation({ course: 'high', periodNo: 1, roomId: 'room-gym', classId: null, requesterId: 't-lee' }),
      makeContext(),
    )

    expect(labels.target).toBe('이바다')
    expect(labels.requester).toBe('이바다')
  })
})
