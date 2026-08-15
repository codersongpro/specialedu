import type { CourseLevel } from '@/lib/scheduling/types'

export interface DefaultPeriod {
  periodNo: number
  label: string
  startsMin: number
  endsMin: number
  isAfterschool: boolean
}

const toMin = (h: number, m: number) => h * 60 + m

export function minutesToTime(min: number): string {
  const h = Math.floor(min / 60)
  const m = min % 60
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
}

/**
 * 새 학교를 열 때 넣어 두는 기본 교시 — 9시 시작, 40분 수업 + 10분 쉬는 시간.
 *
 * 학교마다 실제 시정표(교시 길이·시작 시각)가 다르므로 이건 정답이 아니라
 * 관리자가 화면에서 바로 고쳐 쓸 수 있는 출발점이다. 4개 과정 모두 같은
 * 값으로 시작하고, 학교 관리 화면에서 과정별로 따로 조정한다.
 */
export const DEFAULT_PERIODS: DefaultPeriod[] = [
  { periodNo: 1, label: '1교시', startsMin: toMin(9, 0), endsMin: toMin(9, 40), isAfterschool: false },
  { periodNo: 2, label: '2교시', startsMin: toMin(9, 50), endsMin: toMin(10, 30), isAfterschool: false },
  { periodNo: 3, label: '3교시', startsMin: toMin(10, 40), endsMin: toMin(11, 20), isAfterschool: false },
  { periodNo: 4, label: '4교시', startsMin: toMin(11, 30), endsMin: toMin(12, 10), isAfterschool: false },
  { periodNo: 5, label: '5교시', startsMin: toMin(13, 10), endsMin: toMin(13, 50), isAfterschool: false },
  { periodNo: 6, label: '6교시', startsMin: toMin(14, 0), endsMin: toMin(14, 40), isAfterschool: false },
  { periodNo: 7, label: '7교시', startsMin: toMin(14, 50), endsMin: toMin(15, 30), isAfterschool: false },
]

export const COURSE_LEVELS: CourseLevel[] = ['elementary', 'middle', 'high', 'vocational']
