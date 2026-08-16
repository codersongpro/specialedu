import { describe, expect, it } from 'vitest'
import { groupProgressByGoal, progressTrend, type ProgressEntry } from '@/lib/iep/progress'

function entry(partial: Partial<ProgressEntry> & { id: string; goalId: string }): ProgressEntry {
  return {
    occurredOn: '2026-01-01',
    level: 'independent',
    ...partial,
  }
}

describe('groupProgressByGoal', () => {
  it('목표 ID별로 묶는다', () => {
    const grouped = groupProgressByGoal([
      entry({ id: 'p1', goalId: 'g1', occurredOn: '2026-01-01' }),
      entry({ id: 'p2', goalId: 'g2', occurredOn: '2026-01-01' }),
      entry({ id: 'p3', goalId: 'g1', occurredOn: '2026-01-10' }),
    ])
    expect(new Set(grouped.get('g1')?.map((e) => e.id))).toEqual(new Set(['p1', 'p3']))
    expect(grouped.get('g2')?.map((e) => e.id)).toEqual(['p2'])
  })

  it('같은 목표 안에서는 최신 날짜가 먼저 오도록 정렬한다', () => {
    const grouped = groupProgressByGoal([
      entry({ id: 'p1', goalId: 'g1', occurredOn: '2026-01-05' }),
      entry({ id: 'p2', goalId: 'g1', occurredOn: '2026-01-20' }),
      entry({ id: 'p3', goalId: 'g1', occurredOn: '2026-01-10' }),
    ])
    expect(grouped.get('g1')?.map((e) => e.occurredOn)).toEqual([
      '2026-01-20',
      '2026-01-10',
      '2026-01-05',
    ])
  })

  it('같은 날짜면 id 역순(더 나중에 만들어진 것)을 앞에 둔다', () => {
    const grouped = groupProgressByGoal([
      entry({ id: 'a', goalId: 'g1', occurredOn: '2026-01-05' }),
      entry({ id: 'b', goalId: 'g1', occurredOn: '2026-01-05' }),
    ])
    expect(grouped.get('g1')?.map((e) => e.id)).toEqual(['b', 'a'])
  })

  it('빈 배열을 넣으면 빈 Map을 돌려준다', () => {
    expect(groupProgressByGoal([]).size).toBe(0)
  })
})

describe('progressTrend', () => {
  it('기록이 1건뿐이면 판단할 수 없다', () => {
    expect(progressTrend([{ level: 'independent' }])).toBe('unknown')
  })

  it('기록이 없으면 판단할 수 없다', () => {
    expect(progressTrend([])).toBe('unknown')
  })

  it('최신 기록이 이전보다 나아지면 up', () => {
    expect(progressTrend([{ level: 'independent' }, { level: 'partial_help' }])).toBe('up')
  })

  it('최신 기록이 이전보다 못하면 down', () => {
    expect(progressTrend([{ level: 'full_help' }, { level: 'independent' }])).toBe('down')
  })

  it('같은 수준이면 flat', () => {
    expect(progressTrend([{ level: 'partial_help' }, { level: 'partial_help' }])).toBe('flat')
  })

  it('가장 낮은 단계(전체도움)에서 가장 높은 단계(독립수행)로 가면 up', () => {
    expect(progressTrend([{ level: 'independent' }, { level: 'full_help' }])).toBe('up')
  })
})
