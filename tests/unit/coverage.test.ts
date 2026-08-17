import { describe, expect, it } from 'vitest'
import {
  checkCoverage,
  type SupportAssignment,
  type SupportNeed,
  type SupportStaff,
} from '@/lib/staffing/coverage'

/** 월요일 기본 픽스처 — 필요한 것만 덮어쓴다 */
function need(over: Partial<SupportNeed> = {}): SupportNeed {
  return {
    id: 'n1',
    classId: 'c1',
    className: '초1-1',
    dayOfWeek: 1,
    periodNo: 3,
    startsMin: 640, // 10:40
    endsMin: 680, // 11:20
    ...over,
  }
}

function staff(over: Partial<SupportStaff> = {}): SupportStaff {
  return {
    profileId: 'p1',
    name: '구소라',
    // 09:00~13:00 월요일 근무
    availability: [{ dayOfWeek: 1, startsMin: 540, endsMin: 780 }],
    ...over,
  }
}

describe('보조인력 배치 점검', () => {
  it('제대로 배치되면 경고가 없다', () => {
    const assignments: SupportAssignment[] = [{ needId: 'n1', profileId: 'p1' }]
    const result = checkCoverage([need()], [staff()], assignments)

    expect(result.warnings).toHaveLength(0)
    expect(result.coveredCount).toBe(1)
  })

  it('아무도 안 맡으면 공백으로 잡는다', () => {
    const result = checkCoverage([need()], [staff()], [])

    expect(result.warnings).toHaveLength(1)
    expect(result.warnings[0]?.kind).toBe('uncovered')
    expect(result.warnings[0]?.message).toContain('초1-1')
    expect(result.coveredCount).toBe(0)
  })

  it('근무 시간 밖에 배치하면 공백으로 잡는다', () => {
    // 오후 3교시인데 그 사람은 오전(09:00~10:00)만 근무
    const result = checkCoverage(
      [need()],
      [staff({ availability: [{ dayOfWeek: 1, startsMin: 540, endsMin: 600 }] })],
      [{ needId: 'n1', profileId: 'p1' }],
    )

    expect(result.warnings).toHaveLength(1)
    expect(result.warnings[0]?.kind).toBe('outside_hours')
    expect(result.warnings[0]?.message).toContain('구소라')
    expect(result.coveredCount).toBe(0)
  })

  it('요일이 다르면 근무 시간으로 쳐주지 않는다', () => {
    // 시각은 맞지만 화요일 근무만 등록된 사람을 월요일에 배치
    const result = checkCoverage(
      [need({ dayOfWeek: 1 })],
      [staff({ availability: [{ dayOfWeek: 2, startsMin: 540, endsMin: 780 }] })],
      [{ needId: 'n1', profileId: 'p1' }],
    )

    expect(result.warnings[0]?.kind).toBe('outside_hours')
  })

  it('근무 구간을 일부만 걸치면 통과시키지 않는다', () => {
    // 10:40~11:20 이 필요한데 근무는 11:00 에 끝난다
    const result = checkCoverage(
      [need()],
      [staff({ availability: [{ dayOfWeek: 1, startsMin: 540, endsMin: 660 }] })],
      [{ needId: 'n1', profileId: 'p1' }],
    )

    expect(result.warnings[0]?.kind).toBe('outside_hours')
  })

  it('같은 사람이 겹치는 시간에 두 곳이면 중복으로 잡는다', () => {
    const needs = [
      need({ id: 'n1', className: '초1-1' }),
      need({ id: 'n2', className: '초2-1', classId: 'c2' }),
    ]
    const assignments: SupportAssignment[] = [
      { needId: 'n1', profileId: 'p1' },
      { needId: 'n2', profileId: 'p1' },
    ]
    const result = checkCoverage(needs, [staff()], assignments)

    const doubles = result.warnings.filter((w) => w.kind === 'double_booked')
    expect(doubles).toHaveLength(1)
    expect(doubles[0]?.conflictingNeedId).toBe('n2')
    // 겹친 두 건 모두 정상 집계에서 빠져야 한다
    expect(result.coveredCount).toBe(0)
  })

  it('시간이 안 겹치면 같은 사람이 여러 곳을 맡아도 된다', () => {
    const needs = [
      need({ id: 'n1', periodNo: 3, startsMin: 640, endsMin: 680 }),
      need({ id: 'n2', classId: 'c2', className: '초2-1', periodNo: 4, startsMin: 690, endsMin: 730 }),
    ]
    const result = checkCoverage(needs, [staff()], [
      { needId: 'n1', profileId: 'p1' },
      { needId: 'n2', profileId: 'p1' },
    ])

    expect(result.warnings).toHaveLength(0)
    expect(result.coveredCount).toBe(2)
  })

  it('교시 번호가 같아도 과정별 시정이 다르면 안 겹친 것으로 본다', () => {
    // 이 앱의 핵심 함정 — 초등 3교시(10:40~11:20)와 고등 3교시(11:30~12:20)는
    // 번호는 같지만 실제 시각이 달라 한 사람이 둘 다 맡아도 문제없다.
    const needs = [
      need({ id: 'n1', className: '초1-1', periodNo: 3, startsMin: 640, endsMin: 680 }),
      need({ id: 'n2', classId: 'c2', className: '고3-1', periodNo: 3, startsMin: 690, endsMin: 740 }),
    ]
    const result = checkCoverage(needs, [staff()], [
      { needId: 'n1', profileId: 'p1' },
      { needId: 'n2', profileId: 'p1' },
    ])

    expect(result.warnings.filter((w) => w.kind === 'double_booked')).toHaveLength(0)
  })

  it('교시 번호가 달라도 시각이 겹치면 중복으로 잡는다', () => {
    // 위와 반대 방향 — 번호만 보고 판단하면 놓치는 경우
    const needs = [
      need({ id: 'n1', className: '초1-1', periodNo: 2, startsMin: 590, endsMin: 630 }),
      need({ id: 'n2', classId: 'c2', className: '중1-1', periodNo: 3, startsMin: 595, endsMin: 640 }),
    ]
    const result = checkCoverage(needs, [staff()], [
      { needId: 'n1', profileId: 'p1' },
      { needId: 'n2', profileId: 'p1' },
    ])

    expect(result.warnings.filter((w) => w.kind === 'double_booked')).toHaveLength(1)
  })

  it('배치된 사람이 명단에 없으면 공백으로 다룬다', () => {
    const result = checkCoverage([need()], [], [{ needId: 'n1', profileId: 'ghost' }])

    expect(result.warnings[0]?.kind).toBe('uncovered')
    expect(result.coveredCount).toBe(0)
  })

  it('경고가 있는 것과 없는 것을 함께 세어 준다', () => {
    const needs = [
      need({ id: 'n1', periodNo: 3, startsMin: 640, endsMin: 680 }),
      need({ id: 'n2', classId: 'c2', className: '초2-1', periodNo: 4, startsMin: 690, endsMin: 730 }),
      need({ id: 'n3', classId: 'c3', className: '초3-1', periodNo: 5, startsMin: 740, endsMin: 780 }),
    ]
    // n1 정상 · n2 미배정 · n3 근무시간 밖
    const result = checkCoverage(
      needs,
      [staff({ availability: [{ dayOfWeek: 1, startsMin: 540, endsMin: 700 }] })],
      [
        { needId: 'n1', profileId: 'p1' },
        { needId: 'n3', profileId: 'p1' },
      ],
    )

    expect(result.coveredCount).toBe(1)
    expect(result.warnings.map((w) => w.kind).sort()).toEqual(['outside_hours', 'uncovered'])
  })
})
