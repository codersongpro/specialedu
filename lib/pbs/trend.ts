/**
 * PBS 8주 추세 집계 — 순수 함수.
 *
 * app/(app)/support/pbs/page.tsx 가 이미 불러온 원본 행(occurred_at·
 * categoryName·location)을 요일·분류·장소별 건수로 다시 묶는다. 학생 이름·
 * antecedent/consequence/note 원문은 이 함수에 절대 넘기지 않는다(호출부
 * 책임) — AI 요약으로 나가는 건 이 집계 결과뿐이라 개인정보가 없다.
 */

export interface TrendRecordInput {
  occurredAt: string
  categoryName: string
  location: string | null
}

export interface TrendCount {
  label: string
  count: number
}

export interface TrendBreakdown {
  weeksCovered: number
  totalCount: number
  byWeekday: TrendCount[]
  byCategory: TrendCount[]
  byLocation: TrendCount[]
}

const WEEKDAY_LABELS = ['일', '월', '화', '수', '목', '금', '토']

export function aggregateTrendBreakdown(
  records: readonly TrendRecordInput[],
  weeksCovered = 8,
): TrendBreakdown {
  const weekdayCounts = new Array<number>(7).fill(0)
  const categoryCounts = new Map<string, number>()
  const locationCounts = new Map<string, number>()

  for (const r of records) {
    const day = new Date(r.occurredAt).getDay()
    weekdayCounts[day] = (weekdayCounts[day] ?? 0) + 1
    categoryCounts.set(r.categoryName, (categoryCounts.get(r.categoryName) ?? 0) + 1)
    const loc = r.location?.trim() || '미기록'
    locationCounts.set(loc, (locationCounts.get(loc) ?? 0) + 1)
  }

  return {
    weeksCovered,
    totalCount: records.length,
    byWeekday: WEEKDAY_LABELS.map((label, i) => ({ label, count: weekdayCounts[i] ?? 0 })),
    byCategory: sortDesc(categoryCounts),
    byLocation: sortDesc(locationCounts),
  }
}

function sortDesc(counts: Map<string, number>): TrendCount[] {
  return Array.from(counts, ([label, count]) => ({ label, count })).sort((a, b) => b.count - a.count)
}
