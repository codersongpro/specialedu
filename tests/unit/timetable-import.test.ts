import { describe, expect, it } from 'vitest'
import { parseTimetableRows, type RawTimetableRow, type TimetableImportContext } from '@/lib/import/timetable'

function row(overrides: Partial<RawTimetableRow> & { rowNumber: number }): RawTimetableRow {
  return {
    className: '고3-1',
    dayLabel: '월',
    periodNo: '1',
    subjectName: '',
    teacherName: '김하늘',
    coTeacherName: '',
    roomName: '',
    ...overrides,
  }
}

function baseContext(): TimetableImportContext {
  return {
    classesByName: new Map([
      ['고3-1', { id: 'class-1', course: 'high' }],
      ['초1-1', { id: 'class-2', course: 'elementary' }],
    ]),
    subjectsByName: new Map([['국어', 'subject-1']]),
    roomsByName: new Map([['컴퓨터실', 'room-1']]),
    teachersByName: new Map<string, { id: string; name: string } | 'ambiguous'>([
      ['김하늘', { id: 'teacher-1', name: '김하늘' }],
      ['이바다', { id: 'teacher-2', name: '이바다' }],
      ['중복이름', 'ambiguous'],
    ]),
    periodsByCourse: new Map([
      ['high', [{ no: 1, start: 540, end: 590 }, { no: 2, start: 600, end: 650 }]],
      ['elementary', [{ no: 1, start: 540, end: 580 }]],
    ]),
    existingTeacherBusy: new Map(),
    existingClassSlots: new Set(),
  }
}

describe('시간표 엑셀 업로드 검증', () => {
  it('정상 행은 통과한다', () => {
    const result = parseTimetableRows([row({ rowNumber: 2 })], baseContext())
    expect(result.errors).toEqual([])
    expect(result.valid).toHaveLength(1)
    expect(result.valid[0]).toMatchObject({
      course: 'high',
      day_of_week: 1,
      period_no: 1,
      class_id: 'class-1',
      teacher_id: 'teacher-1',
      co_teacher_id: null,
    })
  })

  it('없는 학급은 거부한다', () => {
    const result = parseTimetableRows([row({ rowNumber: 2, className: '없는학급' })], baseContext())
    expect(result.valid).toHaveLength(0)
    expect(result.errors[0]?.message).toContain('학급')
  })

  it('없는 요일은 거부한다', () => {
    const result = parseTimetableRows([row({ rowNumber: 2, dayLabel: '토' })], baseContext())
    expect(result.errors[0]?.message).toContain('요일')
  })

  it('그 과정에 없는 교시는 거부한다', () => {
    const result = parseTimetableRows([row({ rowNumber: 2, periodNo: '9' })], baseContext())
    expect(result.errors[0]?.message).toContain('교시')
  })

  it('없는 교사 이름은 거부한다', () => {
    const result = parseTimetableRows([row({ rowNumber: 2, teacherName: '모르는사람' })], baseContext())
    expect(result.errors[0]?.message).toContain('찾을 수 없습니다')
  })

  it('이름이 겹치는 교사는 모호하다고 거부한다', () => {
    const result = parseTimetableRows([row({ rowNumber: 2, teacherName: '중복이름' })], baseContext())
    expect(result.errors[0]?.message).toContain('여러 명')
  })

  it('협력교사가 담당교사와 같으면 거부한다', () => {
    const result = parseTimetableRows(
      [row({ rowNumber: 2, teacherName: '김하늘', coTeacherName: '김하늘' })],
      baseContext(),
    )
    expect(result.errors[0]?.message).toContain('협력교사')
  })

  it('같은 파일 안에서 같은 학급·요일·교시가 중복되면 두 번째부터 거부한다', () => {
    const rows = [row({ rowNumber: 2 }), row({ rowNumber: 3, teacherName: '이바다' })]
    const result = parseTimetableRows(rows, baseContext())
    expect(result.valid).toHaveLength(1)
    expect(result.errors[0]?.row).toBe(3)
    expect(result.errors[0]?.message).toContain('이미 시간표가 있습니다')
  })

  it('같은 교사가 같은 시간에 다른 학급 두 곳에 배정되면 거부한다', () => {
    const rows = [
      row({ rowNumber: 2, className: '고3-1' }),
      row({ rowNumber: 3, className: '초1-1', dayLabel: '월', periodNo: '1' }),
    ]
    const result = parseTimetableRows(rows, baseContext())
    expect(result.valid).toHaveLength(1)
    expect(result.errors[0]?.message).toContain('이미 다른 수업')
  })

  it('과정별 시정이 달라 실제로는 겹치는 시각도 잡아낸다', () => {
    // 고등 1교시(540~590)와 초등 1교시(540~580)는 시작이 같아 시작 시각만
    // 비교하면 잡히지만, 실제로 종료 시각까지 겹친다는 걸 overlaps()로 확인한다.
    const rows = [
      row({ rowNumber: 2, className: '고3-1', teacherName: '김하늘' }),
      row({ rowNumber: 3, className: '초1-1', teacherName: '김하늘', periodNo: '1' }),
    ]
    const result = parseTimetableRows(rows, baseContext())
    expect(result.valid).toHaveLength(1)
    expect(result.errors).toHaveLength(1)
  })

  it('기존 DB 시간표와 겹치면 거부한다', () => {
    const ctx = baseContext()
    ctx.existingClassSlots.add('class-1:1:1')
    const result = parseTimetableRows([row({ rowNumber: 2 })], ctx)
    expect(result.valid).toHaveLength(0)
    expect(result.errors[0]?.message).toContain('이미 시간표가 있습니다')
  })

  it('기존 DB에서 그 교사가 바쁘면 거부한다', () => {
    const ctx = baseContext()
    ctx.existingTeacherBusy.set('teacher-1', [{ day: 1, start: 540, end: 590 }])
    const result = parseTimetableRows([row({ rowNumber: 2 })], ctx)
    expect(result.valid).toHaveLength(0)
    expect(result.errors[0]?.message).toContain('이미 다른 수업')
  })

  it('교과·특별실은 비워도 통과한다', () => {
    const result = parseTimetableRows([row({ rowNumber: 2 })], baseContext())
    expect(result.valid[0]).toMatchObject({ subject_id: null, room_id: null })
  })

  it('없는 교과·특별실 이름은 거부한다', () => {
    const result = parseTimetableRows(
      [row({ rowNumber: 2, subjectName: '없는교과' })],
      baseContext(),
    )
    expect(result.errors[0]?.message).toContain('교과')

    const result2 = parseTimetableRows(
      [row({ rowNumber: 2, roomName: '없는특별실' })],
      baseContext(),
    )
    expect(result2.errors[0]?.message).toContain('특별실')
  })
})
