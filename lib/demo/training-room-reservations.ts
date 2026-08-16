type CourseLevel = 'elementary' | 'middle' | 'high' | 'vocational'

type Room = { id: string; name: string }
type Class = { id: string; name: string; requesterId: string | null }

export type TrainingReservation = Record<string, unknown> & {
  school_id: string
  room_id: string
  reserved_date: string
  course: CourseLevel
  period_no: number
  class_id: string
  requester_id: string
  kind: 'regular' | 'onetime' | 'vocational_practice'
  status: 'approved'
  purpose: string
}

const TRAINING_BOOKINGS: Array<{
  roomName: string
  className: string
  course: CourseLevel
  periodNo: number
  kind: TrainingReservation['kind']
  purpose: string
}> = [
  { roomName: '감각통합실', className: '초1-1', course: 'elementary', periodNo: 2, kind: 'regular', purpose: '감각통합 활동' },
  { roomName: '음악치료실', className: '초2-1', course: 'elementary', periodNo: 3, kind: 'regular', purpose: '음악치료 활동' },
  { roomName: '도서실', className: '초3-1', course: 'elementary', periodNo: 5, kind: 'regular', purpose: '그림책 읽기' },
  { roomName: '체육관', className: '중1-1', course: 'middle', periodNo: 2, kind: 'regular', purpose: '뉴스포츠 활동' },
  { roomName: '다목적실', className: '중2-1', course: 'middle', periodNo: 4, kind: 'onetime', purpose: '학년 모임' },
  { roomName: '컴퓨터실', className: '고2-1', course: 'high', periodNo: 2, kind: 'regular', purpose: '정보 활용 수업' },
  { roomName: '요리실습실', className: '고3-1', course: 'high', periodNo: 5, kind: 'vocational_practice', purpose: '샌드위치 만들기' },
  { roomName: '바리스타실습실', className: '전공과1-1', course: 'vocational', periodNo: 1, kind: 'vocational_practice', purpose: '에스프레소 추출' },
  { roomName: '제과제빵실', className: '전공과1-1', course: 'vocational', periodNo: 2, kind: 'vocational_practice', purpose: '쿠키 만들기' },
  { roomName: '목공실', className: '전공과2-1', course: 'vocational', periodNo: 1, kind: 'vocational_practice', purpose: '수납함 제작' },
  { roomName: '세탁실습실', className: '전공과2-1', course: 'vocational', periodNo: 3, kind: 'vocational_practice', purpose: '세탁 실습' },
]

export function buildTrainingRoomReservations({
  schoolId,
  reservedDate,
  rooms,
  classes,
}: {
  schoolId: string
  reservedDate: string
  rooms: Room[]
  classes: Class[]
}): TrainingReservation[] {
  const roomByName = new Map(rooms.map((room) => [room.name, room]))
  const classByName = new Map(classes.map((schoolClass) => [schoolClass.name, schoolClass]))

  return TRAINING_BOOKINGS.map((booking) => {
    const room = roomByName.get(booking.roomName)
    const schoolClass = classByName.get(booking.className)
    if (!room || !schoolClass?.requesterId) {
      throw new Error(`연수용 특별실 예약 기준정보가 없습니다: ${booking.roomName} / ${booking.className}`)
    }

    return {
      school_id: schoolId,
      room_id: room.id,
      reserved_date: reservedDate,
      course: booking.course,
      period_no: booking.periodNo,
      class_id: schoolClass.id,
      requester_id: schoolClass.requesterId,
      kind: booking.kind,
      status: DIRECT_REGISTRATION_STATUS,
      purpose: booking.purpose,
    }
  })
}
import { DIRECT_REGISTRATION_STATUS } from '@/lib/workflow/direct-registration'
