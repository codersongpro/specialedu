import { describe, expect, it } from 'vitest'
import { manualAssignmentDetails, manualAssignmentOptions } from '@/lib/substitution/manual-assignment'

describe('직접 보강 교사 선택', () => {
  const staff = [
    { id: 'teacher-b', name: '박가온', employment: 'full_time' as const },
    { id: 'teacher-a', name: '김하늘', employment: 'part_time' as const },
    { id: 'teacher-c', name: '이바다', employment: 'assistant' as const },
  ]
  const ranked = [
    { candidate: { teacherId: 'teacher-b' }, score: 42, isPaid: false },
    { candidate: { teacherId: 'teacher-a' }, score: 58, isPaid: true },
  ]

  it('전 교직원을 이름 오름차순으로 보여 주고, 불가능한 사람을 구분한다', () => {
    expect(manualAssignmentOptions(staff, ranked)).toEqual([
      { teacherId: 'teacher-a', name: '김하늘', isAvailable: true, isPaid: true },
      { teacherId: 'teacher-b', name: '박가온', isAvailable: true, isPaid: false },
      { teacherId: 'teacher-c', name: '이바다', isAvailable: false, isPaid: false },
    ])
  })

  it('추천 결과에 없는 교사는 서버 배정 정보로 바꾸지 않는다', () => {
    expect(manualAssignmentDetails('teacher-a', ranked)).toEqual({ score: 58, isPaid: true })
    expect(manualAssignmentDetails('teacher-c', ranked)).toBeNull()
  })
})
