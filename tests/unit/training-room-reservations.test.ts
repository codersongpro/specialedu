import { describe, expect, it } from 'vitest'
import { buildTrainingRoomReservations } from '@/lib/demo/training-room-reservations'

const rooms = [
  { id: 'room-sensory', name: '감각통합실' },
  { id: 'room-music', name: '음악치료실' },
  { id: 'room-library', name: '도서실' },
  { id: 'room-computer', name: '컴퓨터실' },
  { id: 'room-cooking', name: '요리실습실' },
  { id: 'room-barista', name: '바리스타실습실' },
  { id: 'room-bakery', name: '제과제빵실' },
  { id: 'room-wood', name: '목공실' },
  { id: 'room-laundry', name: '세탁실습실' },
  { id: 'room-gym', name: '체육관' },
  { id: 'room-multi', name: '다목적실' },
]

const classes = [
  { id: 'class-e1', name: '초1-1', requesterId: 'teacher-e1' },
  { id: 'class-e2', name: '초2-1', requesterId: 'teacher-e2' },
  { id: 'class-e3', name: '초3-1', requesterId: 'teacher-e3' },
  { id: 'class-m1', name: '중1-1', requesterId: 'teacher-m1' },
  { id: 'class-m2', name: '중2-1', requesterId: 'teacher-m2' },
  { id: 'class-h2', name: '고2-1', requesterId: 'teacher-h2' },
  { id: 'class-h3', name: '고3-1', requesterId: 'teacher-h3' },
  { id: 'class-v1', name: '전공과1-1', requesterId: 'teacher-v1' },
  { id: 'class-v2', name: '전공과2-1', requesterId: 'teacher-v2' },
]

describe('연수용 특별실 예약', () => {
  it('주말에도 과정별로 바로 볼 수 있는 고정 예약을 만든다', () => {
    const reservations = buildTrainingRoomReservations({
      schoolId: 'school-demo',
      reservedDate: '2026-08-16',
      rooms,
      classes,
    })

    expect(reservations).toHaveLength(11)
    expect(reservations.every((reservation) => reservation.reserved_date === '2026-08-16')).toBe(true)
    expect(reservations.some((reservation) => reservation.course === 'elementary')).toBe(true)
    expect(reservations.some((reservation) => reservation.course === 'middle')).toBe(true)
    expect(reservations.some((reservation) => reservation.course === 'high')).toBe(true)
    expect(reservations.some((reservation) => reservation.course === 'vocational')).toBe(true)
  })

  it('연수용 특별실 예약은 승인 대기 없이 바로 확정한다', () => {
    const reservations = buildTrainingRoomReservations({
      schoolId: 'school-demo',
      reservedDate: '2026-08-16',
      rooms,
      classes,
    })

    expect(reservations.every((reservation) => reservation.status === 'approved')).toBe(true)
  })
})
