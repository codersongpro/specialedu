import { overlapsAny, runLengthContaining, type TimeSpan } from '@/lib/scheduling/time'
import type { CourseLevel } from '@/lib/scheduling/types'

/**
 * 결보강 후보 스코어링.
 *
 * 학교마다 원칙이 달라 가중치를 코드에 고정하지 않는다.
 * 값은 substitution_rules 테이블에서 오고, 관리자 설정 화면에서 바꾼다.
 */

export interface SubstitutionWeights {
  partTimeFirst: number
  sameSubject: number
  sameCourseGrade: number
  homeroomOfClass: number
  fairnessMax: number
  longRunPenalty: number
  sameFloorBonus: number
}

export const DEFAULT_WEIGHTS: SubstitutionWeights = {
  partTimeFirst: 30,
  sameSubject: 25,
  sameCourseGrade: 20,
  homeroomOfClass: 15,
  fairnessMax: 20,
  longRunPenalty: -25,
  sameFloorBonus: 5,
}

export const DEFAULT_LONG_RUN_THRESHOLD = 4

export interface SubstitutionTarget extends TimeSpan {
  date: string
  dayOfWeek: number
  course: CourseLevel
  grade: number | null
  periodNo: number
  subjectId: string | null
  classId: string | null
  roomFloor: number | null
  /** 결과가 난 교사 — 당연히 후보에서 빠진다 */
  absentTeacherId: string
}

export interface SubstituteCandidate {
  teacherId: string
  name: string
  employment: 'full_time' | 'fixed_term' | 'part_time' | 'assistant'
  isActive: boolean
  /** 출근 요일 (1=월 … 5=금). 시간강사는 특정 요일만 나온다. */
  workDays: number[]
  /** 담당 가능 교과 */
  subjectIds: string[]
  /** 담당 과정 */
  courses: CourseLevel[]
  grades: number[]
  /** 담임·부담임인 학급 */
  homeroomClassIds: string[]
  /** 이번 주 이미 배정된 결보강 시수 */
  weeklySubCount: number
  /** 그날 이미 잡혀 있는 시간 (정규 수업 + 확정된 결보강) */
  busySpans: TimeSpan[]
  /** 그날 이미 수업이 있는 교시 번호 — 연강 판정에 쓴다 */
  busyPeriods: number[]
  /** 인접 교시에 있는 교실 층 */
  adjacentFloors: number[]
}

export type ExclusionReason =
  | 'absent_teacher'
  | 'inactive'
  | 'not_working_day'
  | 'already_busy'

export interface ScoredCandidate {
  candidate: SubstituteCandidate
  score: number
  /** 점수 근거. "왜 이 사람인가"를 화면에 그대로 보여준다. */
  breakdown: Array<{ label: string; points: number }>
  /** 시간강사 수당 정산 대상인지 */
  isPaid: boolean
}

export interface ExcludedCandidate {
  candidate: SubstituteCandidate
  reason: ExclusionReason
  note: string
}

export interface ScoringResult {
  ranked: ScoredCandidate[]
  excluded: ExcludedCandidate[]
}

export function scoreCandidates(
  target: SubstitutionTarget,
  candidates: readonly SubstituteCandidate[],
  weights: SubstitutionWeights = DEFAULT_WEIGHTS,
  longRunThreshold: number = DEFAULT_LONG_RUN_THRESHOLD,
): ScoringResult {
  const ranked: ScoredCandidate[] = []
  const excluded: ExcludedCandidate[] = []

  // 형평성 계산의 기준. 아무도 결보강을 안 했으면 이 항목은 무의미하므로 1로 둔다.
  const maxWeekly = Math.max(1, ...candidates.map((c) => c.weeklySubCount))

  for (const candidate of candidates) {
    // --- 하드 제외 -----------------------------------------------------------
    if (candidate.teacherId === target.absentTeacherId) {
      excluded.push({ candidate, reason: 'absent_teacher', note: '결과 당사자' })
      continue
    }
    if (!candidate.isActive) {
      excluded.push({ candidate, reason: 'inactive', note: '비활성 계정' })
      continue
    }
    if (!candidate.workDays.includes(target.dayOfWeek)) {
      excluded.push({
        candidate,
        reason: 'not_working_day',
        note: `${dayLabel(target.dayOfWeek)}요일 출근 아님`,
      })
      continue
    }
    if (overlapsAny(target, candidate.busySpans)) {
      excluded.push({ candidate, reason: 'already_busy', note: '이 시간에 수업 있음' })
      continue
    }

    // --- 점수 ----------------------------------------------------------------
    const breakdown: Array<{ label: string; points: number }> = []
    let score = 0

    if (candidate.employment === 'part_time') {
      score += weights.partTimeFirst
      breakdown.push({ label: '시간강사', points: weights.partTimeFirst })
    }

    if (target.subjectId && candidate.subjectIds.includes(target.subjectId)) {
      score += weights.sameSubject
      breakdown.push({ label: '같은 교과 담당', points: weights.sameSubject })
    }

    // 과정과 학년이 모두 맞으면 만점, 과정만 맞으면 절반.
    // 특수학교는 과정별로 학생 특성이 크게 달라 이 항목이 실제로 중요하다.
    if (candidate.courses.includes(target.course)) {
      const gradeMatches = target.grade != null && candidate.grades.includes(target.grade)
      const points = gradeMatches
        ? weights.sameCourseGrade
        : Math.round(weights.sameCourseGrade / 2)
      score += points
      breakdown.push({
        label: gradeMatches ? '같은 과정·학년' : '같은 과정',
        points,
      })
    }

    if (target.classId && candidate.homeroomClassIds.includes(target.classId)) {
      score += weights.homeroomOfClass
      breakdown.push({ label: '이 학급 담임·부담임', points: weights.homeroomOfClass })
    }

    // 결보강이 특정 교사에게 몰리지 않게. 적게 한 사람일수록 높은 점수.
    const fairness = Math.round(
      weights.fairnessMax * (1 - candidate.weeklySubCount / maxWeekly),
    )
    if (fairness !== 0) {
      score += fairness
      breakdown.push({
        label: `이번 주 결보강 ${candidate.weeklySubCount}시간`,
        points: fairness,
      })
    }

    // 연강이 길어지면 감점. 특수학교 수업은 체력 소모가 커서 실제로 문제가 된다.
    const runLength = runLengthContaining(candidate.busyPeriods, target.periodNo)
    if (runLength >= longRunThreshold) {
      score += weights.longRunPenalty
      breakdown.push({
        label: `연강 ${runLength}교시가 됨`,
        points: weights.longRunPenalty,
      })
    }

    if (target.roomFloor != null && candidate.adjacentFloors.includes(target.roomFloor)) {
      score += weights.sameFloorBonus
      breakdown.push({ label: '앞뒤 교시와 같은 층', points: weights.sameFloorBonus })
    }

    ranked.push({
      candidate,
      score,
      breakdown,
      isPaid: candidate.employment === 'part_time',
    })
  }

  ranked.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score
    // 점수가 같으면 이번 주 결보강이 적은 사람을 앞에 둔다
    if (a.candidate.weeklySubCount !== b.candidate.weeklySubCount) {
      return a.candidate.weeklySubCount - b.candidate.weeklySubCount
    }
    return a.candidate.name.localeCompare(b.candidate.name, 'ko')
  })

  return { ranked, excluded }
}

const DAY_LABELS = ['', '월', '화', '수', '목', '금', '토', '일'] as const

function dayLabel(dayOfWeek: number): string {
  return DAY_LABELS[dayOfWeek] ?? '해당'
}
