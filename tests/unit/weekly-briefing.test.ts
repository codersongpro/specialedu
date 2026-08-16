import { describe, expect, it } from 'vitest'
import { buildWeeklyBriefing } from '@/lib/workflow/weekly-briefing'

describe('buildWeeklyBriefing', () => {
  it('groups only operational counts without exposing staff or student names', () => {
    const result = buildWeeklyBriefing({
      weekStart: '2026-08-17', lessons: 12, reservations: 3, substitutions: 1, events: ['교내 연수', '개학식'], budgetItems: 2,
    })

    expect(result).toContain('8월 17일(월) 주간 업무 브리핑')
    expect(result).toContain('수업 12건')
    expect(result).toContain('특별실 예약 3건')
    expect(result).toContain('결보강 1건')
    expect(result).toContain('교내 연수')
    expect(result).not.toContain('홍길동')
  })
})
