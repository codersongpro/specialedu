import { describe, expect, it } from 'vitest'
import { aggregateTrendBreakdown, type TrendRecordInput } from '@/lib/pbs/trend'

function record(over: Partial<TrendRecordInput> = {}): TrendRecordInput {
  return { occurredAt: '2026-03-09T09:00:00Z', categoryName: '공격행동', location: '교실', ...over }
}

describe('PBS 8주 추세 집계', () => {
  it('기록이 없으면 전부 0건이다', () => {
    const result = aggregateTrendBreakdown([])
    expect(result.totalCount).toBe(0)
    expect(result.byWeekday.every((w) => w.count === 0)).toBe(true)
    expect(result.byCategory).toEqual([])
    expect(result.byLocation).toEqual([])
  })

  it('요일별로 건수를 센다', () => {
    // 2026-03-09는 월요일
    const records = [
      record({ occurredAt: '2026-03-09T09:00:00Z' }),
      record({ occurredAt: '2026-03-09T10:00:00Z' }),
      record({ occurredAt: '2026-03-10T09:00:00Z' }), // 화요일
    ]
    const result = aggregateTrendBreakdown(records)
    expect(result.byWeekday.find((w) => w.label === '월')?.count).toBe(2)
    expect(result.byWeekday.find((w) => w.label === '화')?.count).toBe(1)
    expect(result.totalCount).toBe(3)
  })

  it('분류별 건수를 많은 순으로 정렬한다', () => {
    const records = [
      record({ categoryName: '공격행동' }),
      record({ categoryName: '공격행동' }),
      record({ categoryName: '이탈행동' }),
    ]
    const result = aggregateTrendBreakdown(records)
    expect(result.byCategory).toEqual([
      { label: '공격행동', count: 2 },
      { label: '이탈행동', count: 1 },
    ])
  })

  it('장소가 없으면 미기록으로 묶는다', () => {
    const records = [record({ location: null }), record({ location: '  ' }), record({ location: '체육관' })]
    const result = aggregateTrendBreakdown(records)
    expect(result.byLocation).toEqual([
      { label: '미기록', count: 2 },
      { label: '체육관', count: 1 },
    ])
  })

  it('weeksCovered를 그대로 반환한다', () => {
    expect(aggregateTrendBreakdown([], 8).weeksCovered).toBe(8)
    expect(aggregateTrendBreakdown([], 4).weeksCovered).toBe(4)
  })
})
