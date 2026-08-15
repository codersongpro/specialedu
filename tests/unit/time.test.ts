import { describe, expect, it } from 'vitest'
import {
  longestRun,
  overlaps,
  runLengthContaining,
  toHHMM,
  toMinutes,
} from '@/lib/scheduling/time'

describe('시각 변환', () => {
  it('HH:MM 과 분을 오간다', () => {
    expect(toMinutes('09:00')).toBe(540)
    expect(toMinutes('9:05')).toBe(545)
    expect(toHHMM(540)).toBe('09:00')
    expect(toHHMM(1439)).toBe('23:59')
  })

  it('잘못된 형식은 거부한다', () => {
    expect(() => toMinutes('아홉시')).toThrow()
    expect(() => toMinutes('25:00')).toThrow()
    expect(() => toMinutes('09:70')).toThrow()
  })
})

describe('구간 겹침', () => {
  it('경계가 맞닿는 것은 겹침이 아니다', () => {
    // 이게 아니면 연속 교시가 전부 충돌로 잡힌다
    expect(overlaps({ startsMin: 540, endsMin: 590 }, { startsMin: 590, endsMin: 640 })).toBe(false)
  })

  it('1분이라도 겹치면 겹침이다', () => {
    expect(overlaps({ startsMin: 540, endsMin: 591 }, { startsMin: 590, endsMin: 640 })).toBe(true)
  })

  it('한쪽이 다른 쪽을 완전히 품어도 겹침이다', () => {
    // 전공과 블록타임이 초등 한 교시를 통째로 삼키는 경우
    expect(overlaps({ startsMin: 540, endsMin: 640 }, { startsMin: 560, endsMin: 600 })).toBe(true)
  })
})

describe('연강 판정', () => {
  it('가장 긴 연속 묶음을 센다', () => {
    expect(longestRun([1, 2, 3, 5, 6])).toBe(3)
    expect(longestRun([1, 3, 5])).toBe(1)
    expect(longestRun([])).toBe(0)
  })

  it('중복된 교시는 한 번만 센다', () => {
    expect(longestRun([1, 1, 2, 2, 3])).toBe(3)
  })

  it('특정 교시를 넣었을 때 만들어지는 연강 길이를 센다', () => {
    // 1,2,4교시가 차 있는데 3교시를 넣으면 1~4 연강이 된다
    expect(runLengthContaining([1, 2, 4], 3)).toBe(4)
    expect(runLengthContaining([1], 3)).toBe(1)
    expect(runLengthContaining([], 3)).toBe(1)
  })
})
