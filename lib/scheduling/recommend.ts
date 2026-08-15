import { findConflicts, hasBlocking } from './conflicts'
import { runLengthContaining } from './time'
import type {
  BookingKind,
  BookingRequest,
  Conflict,
  CourseLevel,
  Room,
  ScheduleContext,
} from './types'

export interface RoomSuggestion {
  room: Room
  score: number
  /** 왜 이 방을 추천했는지. 화면에 그대로 보여준다. */
  reasons: string[]
  conflicts: Conflict[]
  available: boolean
}

export interface RecommendOptions {
  /** 꼭 필요한 설비 (예: ['조리대', '싱크대']) */
  requiredFeatures?: string[]
  /** 이 수업을 듣는 인원 */
  headcount?: number
  /** 학급 교실이 있는 층. 이동 거리를 줄이는 데 쓴다. */
  homeFloor?: number | null
  /** 이 학급이 각 특별실을 이번 학기에 몇 번 썼는지 — 쏠림을 막는다 */
  usageByRoom?: Map<string, number>
  /** 같은 날 이 학급이 이미 쓰는 특별실의 교시 목록 */
  sameDayRoomPeriods?: Map<string, number[]>
}

const WEIGHTS = {
  featureMatch: 40,
  typeAffinity: 30,
  capacityFit: 10,
  capacityShort: -60,
  fairnessMax: 20,
  sameFloor: 8,
  adjacentPeriodSameRoom: 15,
} as const

/**
 * 배정 가능한 특별실을 점수 순으로 돌려준다.
 *
 * 자동으로 확정하지 않는다. 특수학교는 학생 개별 사정에 따른 예외가 많아
 * 사람이 최종 결정을 해야 하고, 시스템은 근거를 붙여 후보만 제시한다.
 */
export function recommendRooms(
  req: Omit<BookingRequest, 'roomId'>,
  ctx: ScheduleContext,
  opts: RecommendOptions = {},
): RoomSuggestion[] {
  const suggestions: RoomSuggestion[] = []
  const maxUsage = Math.max(1, ...[...(opts.usageByRoom?.values() ?? [])])

  for (const room of ctx.rooms.values()) {
    if (!room.isActive) continue

    const conflicts = findConflicts({ ...req, roomId: room.id }, ctx)
    const available = !hasBlocking(conflicts)

    let score = 0
    const reasons: string[] = []

    // 설비가 맞는지 — 요리 수업을 목공실에 넣으면 안 된다
    const required = opts.requiredFeatures ?? []
    if (required.length > 0) {
      const matched = required.filter((f) => room.features.includes(f))
      const ratio = matched.length / required.length
      score += WEIGHTS.featureMatch * ratio
      if (ratio === 1) reasons.push('필요한 설비가 모두 있음')
      else if (matched.length > 0) reasons.push(`설비 ${matched.length}/${required.length}개 충족`)
    }

    // 용도 적합도
    const affinity = typeAffinity(room, req.kind, req.course)
    if (affinity > 0) {
      score += WEIGHTS.typeAffinity * affinity
      reasons.push(affinityReason(req.kind))
    }

    // 정원
    if (opts.headcount != null && room.capacity != null) {
      if (room.capacity < opts.headcount) {
        score += WEIGHTS.capacityShort
        reasons.push(`정원 ${room.capacity}명 — ${opts.headcount}명이 들어가기 어려움`)
      } else {
        score += WEIGHTS.capacityFit
      }
    }

    // 형평성 — 특정 학급이 좋은 방을 독점하지 않게
    const used = opts.usageByRoom?.get(room.id) ?? 0
    score += WEIGHTS.fairnessMax * (1 - used / maxUsage)
    if (used === 0) reasons.push('이번 학기 아직 안 쓴 방')

    // 이동 거리
    if (opts.homeFloor != null && room.floor != null && room.floor === opts.homeFloor) {
      score += WEIGHTS.sameFloor
      reasons.push('교실과 같은 층')
    }

    // 앞뒤 교시에 같은 방을 쓰면 이동이 줄어든다
    const periodsHere = opts.sameDayRoomPeriods?.get(room.id) ?? []
    if (periodsHere.length > 0 && runLengthContaining(periodsHere, req.periodNo) > 1) {
      score += WEIGHTS.adjacentPeriodSameRoom
      reasons.push('앞뒤 교시에도 이 방 사용 — 이동 없음')
    }

    suggestions.push({
      room,
      score: Math.round(score),
      reasons,
      conflicts,
      available,
    })
  }

  return suggestions.sort((a, b) => {
    if (a.available !== b.available) return a.available ? -1 : 1
    return b.score - a.score
  })
}

/**
 * 예약 승인 우선순위.
 *
 * 같은 시간대에 두 건이 경합할 때 어느 쪽을 먼저 볼지 정한다.
 * 전공과 직업실습은 대체 장소가 없고 학점·자격증과 직결되어 가장 앞에 둔다.
 * 방과후는 정규 교육과정이 아니라 뒤로 밀린다.
 */
export function bookingPriority(kind: BookingKind, course: CourseLevel): number {
  const byKind: Record<BookingKind, number> = {
    vocational_practice: 100,
    regular: 70,
    co_teaching: 65,
    onetime: 40,
    afterschool: 20,
  }
  const courseBonus = course === 'vocational' ? 5 : 0
  return byKind[kind] + courseBonus
}

function typeAffinity(room: Room, kind: BookingKind, course: CourseLevel): number {
  const type = room.roomType
  if (kind === 'vocational_practice' || course === 'vocational') {
    return type === 'vocational' || type === 'cooking' || type === 'workshop' ? 1 : 0
  }
  if (kind === 'afterschool') return type === 'multipurpose' ? 0.5 : 0
  if (kind === 'co_teaching') return type === 'multipurpose' || type === 'general' ? 0.5 : 0
  return 0
}

function affinityReason(kind: BookingKind): string {
  if (kind === 'vocational_practice') return '직업실습에 맞는 실습실'
  if (kind === 'afterschool') return '방과후 활동에 적합'
  return '수업 형태에 맞는 공간'
}
