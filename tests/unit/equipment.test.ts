import { describe, expect, it } from 'vitest'
import { remainingQuantity, type EquipmentItem, type EquipmentLoan } from '@/lib/equipment/availability'

function item(over: Partial<EquipmentItem> = {}): EquipmentItem {
  return { id: 'i1', totalQuantity: 5, ...over }
}

function loan(over: Partial<EquipmentLoan> = {}): EquipmentLoan {
  return {
    id: 'l1',
    itemId: 'i1',
    quantity: 2,
    startsOn: '2026-09-01',
    endsOn: '2026-09-05',
    returnedAt: null,
    ...over,
  }
}

describe('교구 대여 재고 확인', () => {
  it('대여가 없으면 전체 수량이 남는다', () => {
    expect(remainingQuantity(item(), [], { startsOn: '2026-09-01', endsOn: '2026-09-05' })).toBe(5)
  })

  it('겹치지 않는 대여는 남은 수량에서 빼지 않는다', () => {
    const loans = [loan({ startsOn: '2026-09-10', endsOn: '2026-09-12' })]
    expect(remainingQuantity(item(), loans, { startsOn: '2026-09-01', endsOn: '2026-09-05' })).toBe(5)
  })

  it('부분적으로 겹치는 대여는 수량을 뺀다', () => {
    const loans = [loan({ quantity: 2, startsOn: '2026-09-03', endsOn: '2026-09-08' })]
    expect(remainingQuantity(item(), loans, { startsOn: '2026-09-01', endsOn: '2026-09-05' })).toBe(3)
  })

  it('반납된 대여는 빼지 않는다', () => {
    const loans = [
      loan({ quantity: 4, startsOn: '2026-09-01', endsOn: '2026-09-05', returnedAt: '2026-09-04T00:00:00Z' }),
    ]
    expect(remainingQuantity(item(), loans, { startsOn: '2026-09-01', endsOn: '2026-09-05' })).toBe(5)
  })

  it('다른 품목의 대여는 무시한다', () => {
    const loans = [loan({ itemId: 'other', quantity: 5 })]
    expect(remainingQuantity(item(), loans, { startsOn: '2026-09-01', endsOn: '2026-09-05' })).toBe(5)
  })

  it('여러 대여가 겹치면 전부 합산한다', () => {
    const loans = [
      loan({ id: 'l1', quantity: 2, startsOn: '2026-09-01', endsOn: '2026-09-03' }),
      loan({ id: 'l2', quantity: 2, startsOn: '2026-09-02', endsOn: '2026-09-04' }),
    ]
    expect(remainingQuantity(item(), loans, { startsOn: '2026-09-01', endsOn: '2026-09-05' })).toBe(1)
  })

  it('정확히 소진되면 0이 남는다', () => {
    const loans = [loan({ quantity: 5, startsOn: '2026-09-01', endsOn: '2026-09-05' })]
    expect(remainingQuantity(item(), loans, { startsOn: '2026-09-01', endsOn: '2026-09-05' })).toBe(0)
  })

  it('초과된 상태면 음수를 그대로 돌려준다(막지 않고 보여줌)', () => {
    const loans = [loan({ quantity: 7, startsOn: '2026-09-01', endsOn: '2026-09-05' })]
    expect(remainingQuantity(item(), loans, { startsOn: '2026-09-01', endsOn: '2026-09-05' })).toBe(-2)
  })

  it('자기 자신(수정 중인 대여)은 제외하고 계산한다', () => {
    const loans = [loan({ id: 'l1', quantity: 2, startsOn: '2026-09-01', endsOn: '2026-09-05' })]
    expect(
      remainingQuantity(item(), loans, { startsOn: '2026-09-01', endsOn: '2026-09-05' }, 'l1'),
    ).toBe(5)
  })

  it('경계에서 하루만 겹쳐도 겹침으로 본다', () => {
    const loans = [loan({ quantity: 3, startsOn: '2026-09-05', endsOn: '2026-09-10' })]
    expect(remainingQuantity(item(), loans, { startsOn: '2026-09-01', endsOn: '2026-09-05' })).toBe(2)
  })

  it('바로 붙어 있지만 겹치지 않는 기간은 빼지 않는다', () => {
    const loans = [loan({ quantity: 3, startsOn: '2026-09-06', endsOn: '2026-09-10' })]
    expect(remainingQuantity(item(), loans, { startsOn: '2026-09-01', endsOn: '2026-09-05' })).toBe(5)
  })
})
