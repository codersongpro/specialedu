import { describe, expect, it } from 'vitest'
import { DIRECT_REGISTRATION_STATUS } from '@/lib/workflow/direct-registration'

describe('즉시 등록', () => {
  it('특별실 예약과 예산 지출은 등록 즉시 확정 상태를 사용한다', () => {
    expect(DIRECT_REGISTRATION_STATUS).toBe('approved')
  })
})
