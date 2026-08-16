import { describe, expect, it } from 'vitest'
import { availableEquipmentQuantity } from '@/lib/equipment/availability'

describe('교구 대여 가능 수량', () => {
  it('반납되지 않은 대여 수량을 보유 수량에서 뺀다', () => {
    expect(
      availableEquipmentQuantity(5, [
        { quantity: 2, returnedAt: null },
        { quantity: 1, returnedAt: '2026-08-16T10:00:00Z' },
      ]),
    ).toBe(3)
  })

  it('대여 수량이 보유 수량을 넘더라도 음수가 되지 않는다', () => {
    expect(availableEquipmentQuantity(1, [{ quantity: 3, returnedAt: null }])).toBe(0)
  })
})
