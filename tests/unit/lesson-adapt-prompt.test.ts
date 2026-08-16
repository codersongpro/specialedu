import { describe, expect, it } from 'vitest'
import { lessonAdaptPrompt } from '@/lib/lesson-adapt/prompt'

describe('수준별 수업 변환 프롬프트', () => {
  it('수업 조건과 결과 형식을 모두 포함한다', () => {
    const prompt = lessonAdaptPrompt({
      course: '고등',
      subject: '국어',
      topic: '시장 보기',
      objective: '물건 값을 비교한다',
      material: '가격표 읽기 활동지',
      level: 1,
      duration: 40,
      supplies: '가격표, 계산기',
    })

    expect(prompt).toContain('과정: 고등')
    expect(prompt).toContain('목표 수준: 1단계')
    expect(prompt).toContain('도입')
    expect(prompt).toContain('교사 확인 항목')
  })
})
