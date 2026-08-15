import { describe, expect, it } from 'vitest'
import {
  DEFAULT_WEIGHTS,
  scoreCandidates,
  type SubstituteCandidate,
  type SubstitutionTarget,
} from '@/lib/substitution/score'
import { period } from './fixtures'

const p3 = period('high', 3)

const target: SubstitutionTarget = {
  date: '2026-03-09',
  dayOfWeek: 1,
  course: 'high',
  grade: 3,
  periodNo: 3,
  startsMin: p3.startsMin,
  endsMin: p3.endsMin,
  subjectId: 'sub-music',
  classId: 'cls-h3a',
  roomFloor: 2,
  absentTeacherId: 't-absent',
}

function candidate(partial: Partial<SubstituteCandidate> & { teacherId: string; name: string }): SubstituteCandidate {
  return {
    employment: 'full_time',
    isActive: true,
    workDays: [1, 2, 3, 4, 5],
    subjectIds: [],
    courses: [],
    grades: [],
    homeroomClassIds: [],
    weeklySubCount: 0,
    busySpans: [],
    busyPeriods: [],
    adjacentFloors: [],
    ...partial,
  }
}

describe('하드 제외', () => {
  it('결과 당사자는 후보에서 뺀다', () => {
    const { ranked, excluded } = scoreCandidates(target, [
      candidate({ teacherId: 't-absent', name: '결과교사' }),
    ])
    expect(ranked).toHaveLength(0)
    expect(excluded[0]?.reason).toBe('absent_teacher')
  })

  it('그 시간에 수업이 있으면 뺀다', () => {
    const { ranked, excluded } = scoreCandidates(target, [
      candidate({
        teacherId: 't-busy',
        name: '이바다',
        busySpans: [{ startsMin: p3.startsMin, endsMin: p3.endsMin }],
      }),
    ])
    expect(ranked).toHaveLength(0)
    expect(excluded[0]?.reason).toBe('already_busy')
  })

  it('시간이 닿기만 하고 겹치지 않으면 후보로 남는다', () => {
    // 앞 교시가 11:00 에 끝나고 대상 수업이 11:00 에 시작 — 겹치지 않는다
    const { ranked } = scoreCandidates(target, [
      candidate({
        teacherId: 't-ok',
        name: '박가온',
        busySpans: [{ startsMin: p3.startsMin - 50, endsMin: p3.startsMin }],
      }),
    ])
    expect(ranked).toHaveLength(1)
  })

  it('시간강사 출근 요일이 아니면 뺀다', () => {
    const { ranked, excluded } = scoreCandidates(target, [
      candidate({
        teacherId: 't-pt',
        name: '최나래',
        employment: 'part_time',
        workDays: [2, 4],
      }),
    ])
    expect(ranked).toHaveLength(0)
    expect(excluded[0]?.reason).toBe('not_working_day')
    expect(excluded[0]?.note).toContain('월요일')
  })
})

describe('가중치', () => {
  it('시간강사를 정교사보다 앞에 둔다', () => {
    const { ranked } = scoreCandidates(target, [
      candidate({ teacherId: 't-full', name: '정교사' }),
      candidate({ teacherId: 't-part', name: '시간강사', employment: 'part_time' }),
    ])
    expect(ranked[0]?.candidate.teacherId).toBe('t-part')
    expect(ranked[0]?.isPaid).toBe(true)
    expect(ranked[1]?.isPaid).toBe(false)
  })

  it('같은 교과를 담당하면 점수가 오른다', () => {
    const { ranked } = scoreCandidates(target, [
      candidate({ teacherId: 't-other', name: '가나다', subjectIds: ['sub-pe'] }),
      candidate({ teacherId: 't-music', name: '라마바', subjectIds: ['sub-music'] }),
    ])
    expect(ranked[0]?.candidate.teacherId).toBe('t-music')
    expect(ranked[0]?.breakdown.some((b) => b.label === '같은 교과 담당')).toBe(true)
  })

  it('과정만 맞으면 절반, 학년까지 맞으면 만점', () => {
    const { ranked } = scoreCandidates(target, [
      candidate({ teacherId: 't-course', name: '과정만', courses: ['high'], grades: [1] }),
      candidate({ teacherId: 't-grade', name: '학년까지', courses: ['high'], grades: [3] }),
    ])
    const courseOnly = ranked.find((r) => r.candidate.teacherId === 't-course')
    const gradeMatch = ranked.find((r) => r.candidate.teacherId === 't-grade')
    expect(gradeMatch!.score).toBeGreaterThan(courseOnly!.score)
    expect(courseOnly?.breakdown.some((b) => b.label === '같은 과정')).toBe(true)
    expect(gradeMatch?.breakdown.some((b) => b.label === '같은 과정·학년')).toBe(true)
  })

  it('결보강을 적게 한 사람에게 형평성 가점을 준다', () => {
    const { ranked } = scoreCandidates(target, [
      candidate({ teacherId: 't-many', name: '많이한사람', weeklySubCount: 8 }),
      candidate({ teacherId: 't-few', name: '적게한사람', weeklySubCount: 0 }),
    ])
    expect(ranked[0]?.candidate.teacherId).toBe('t-few')
  })

  it('연강이 기준을 넘으면 감점한다', () => {
    // 1,2,4교시가 이미 차 있고 3교시를 넣으면 1~4교시 연강이 된다
    const { ranked } = scoreCandidates(target, [
      candidate({ teacherId: 't-run', name: '연강', busyPeriods: [1, 2, 4] }),
      candidate({ teacherId: 't-free', name: '여유', busyPeriods: [1] }),
    ])
    const run = ranked.find((r) => r.candidate.teacherId === 't-run')
    expect(run?.breakdown.some((b) => b.label.includes('연강 4교시'))).toBe(true)
    expect(ranked[0]?.candidate.teacherId).toBe('t-free')
  })

  it('점수 근거를 항목별로 돌려준다', () => {
    const { ranked } = scoreCandidates(target, [
      candidate({
        teacherId: 't-all',
        name: '최적',
        employment: 'part_time',
        subjectIds: ['sub-music'],
        courses: ['high'],
        grades: [3],
        homeroomClassIds: ['cls-h3a'],
        adjacentFloors: [2],
      }),
    ])
    const labels = ranked[0]?.breakdown.map((b) => b.label) ?? []
    expect(labels).toContain('시간강사')
    expect(labels).toContain('같은 교과 담당')
    expect(labels).toContain('같은 과정·학년')
    expect(labels).toContain('이 학급 담임·부담임')
    expect(labels).toContain('앞뒤 교시와 같은 층')
  })
})

describe('학교별 규칙 조정', () => {
  it('가중치를 바꾸면 순위가 뒤집힌다', () => {
    const candidates = [
      candidate({ teacherId: 't-part', name: '시간강사', employment: 'part_time' }),
      candidate({ teacherId: 't-subject', name: '교과교사', subjectIds: ['sub-music'] }),
    ]

    const asDefault = scoreCandidates(target, candidates, DEFAULT_WEIGHTS)
    expect(asDefault.ranked[0]?.candidate.teacherId).toBe('t-part')

    // 시간강사 우선을 끄고 교과 일치를 높이면 결과가 달라진다
    const custom = scoreCandidates(target, candidates, {
      ...DEFAULT_WEIGHTS,
      partTimeFirst: 0,
      sameSubject: 50,
    })
    expect(custom.ranked[0]?.candidate.teacherId).toBe('t-subject')
  })

  it('연강 기준을 낮추면 더 일찍 감점된다', () => {
    const candidates = [candidate({ teacherId: 't-run', name: '연강', busyPeriods: [2] })]

    const lenient = scoreCandidates(target, candidates, DEFAULT_WEIGHTS, 4)
    expect(lenient.ranked[0]?.breakdown.some((b) => b.label.includes('연강'))).toBe(false)

    const strict = scoreCandidates(target, candidates, DEFAULT_WEIGHTS, 2)
    expect(strict.ranked[0]?.breakdown.some((b) => b.label.includes('연강'))).toBe(true)
  })
})
