/**
 * 정규 시간표 엑셀 업로드 — 파싱·검증(순수 함수).
 *
 * 지금까지 timetable_slots(정규 시간표)를 채울 수 있는 화면이 앱 어디에도
 * 없었다 — 데모 시드만 만들 수 있었다. 실제 학교는 컴시간 같은 툴에서
 * 뽑은 시간표를 넣어야 하는데, 그걸 한 칸씩 입력하는 건 현실적이지 않다.
 *
 * DB(GIST EXCLUDE 제약)가 "같은 교사가 겹치는 시각에 두 수업"은 막아 주지만,
 * 그건 행 하나가 실패하면 삽입 전체가 실패하는 방식이라 사용자 경험이
 * 나쁘다. 그래서 여기서 미리 같은 걱정을 해서 문제 있는 행만 골라내고,
 * 나머지는 안전하게 반영할 수 있게 한다. exceljs로 파일을 읽는 부분과
 * 분리해 뒀다 — 이 파일은 순수 함수라 실제 엑셀 파일 없이도 테스트할 수 있다.
 */
import { overlaps } from '@/lib/scheduling/time'
import type { CourseLevel } from '@/lib/scheduling/types'

export const TIMETABLE_TEMPLATE_HEADERS = [
  '학급',
  '요일',
  '교시',
  '교과',
  '담당교사',
  '협력교사(선택)',
  '특별실(선택)',
] as const

const DAY_LABELS: Record<string, number> = {
  월: 1,
  화: 2,
  수: 3,
  목: 4,
  금: 5,
  '1': 1,
  '2': 2,
  '3': 3,
  '4': 4,
  '5': 5,
}

export interface RawTimetableRow {
  /** 스프레드시트 행 번호(1행이 머리글) — 오류 메시지에 그대로 쓴다 */
  rowNumber: number
  className: string
  dayLabel: string
  periodNo: string
  subjectName: string
  teacherName: string
  coTeacherName: string
  roomName: string
}

type TeacherLookup = { id: string; name: string } | 'ambiguous'

export interface TimetableImportContext {
  classesByName: Map<string, { id: string; course: CourseLevel }>
  subjectsByName: Map<string, string>
  roomsByName: Map<string, string>
  /** 이름이 겹치는 교직원이 있으면 값이 'ambiguous' — 그 이름은 통째로 거부한다 */
  teachersByName: Map<string, TeacherLookup>
  periodsByCourse: Map<CourseLevel, Array<{ no: number; start: number; end: number }>>
  /** 이미 DB에 있는 시간표 — 같은 교사가 그 시각에 또 배정되면 막는다 */
  existingTeacherBusy: Map<string, Array<{ day: number; start: number; end: number }>>
  /** `${classId}:${day}:${periodNo}` — 이미 그 칸이 채워진 학급 */
  existingClassSlots: Set<string>
}

export interface TimetableInsertRow {
  course: CourseLevel
  day_of_week: number
  period_no: number
  class_id: string
  teacher_id: string
  co_teacher_id: string | null
  subject_id: string | null
  room_id: string | null
}

export interface TimetableImportError {
  row: number
  message: string
}

export interface TimetableImportResult {
  valid: TimetableInsertRow[]
  errors: TimetableImportError[]
}

function resolveTeacher(
  ctx: TimetableImportContext,
  name: string,
  role: '담당' | '협력',
  fail: (message: string) => void,
): { id: string; name: string } | null {
  const entry = ctx.teachersByName.get(name)
  if (!entry) {
    fail(`${role}교사 "${name}"를 찾을 수 없습니다`)
    return null
  }
  if (entry === 'ambiguous') {
    fail(`${role}교사 이름 "${name}"이 같은 이름의 교직원이 여러 명이라 구분할 수 없습니다`)
    return null
  }
  return entry
}

export function parseTimetableRows(
  rows: readonly RawTimetableRow[],
  ctx: TimetableImportContext,
): TimetableImportResult {
  const valid: TimetableInsertRow[] = []
  const errors: TimetableImportError[] = []

  // ctx 는 "지금 DB 상태"고, 파일 안에서 뒤 행이 앞 행과 겹치는지도 봐야
  // 하므로 사본을 만들어 통과한 행을 즉시 반영해 나간다.
  const teacherBusy = new Map<string, Array<{ day: number; start: number; end: number }>>()
  for (const [id, spans] of ctx.existingTeacherBusy) teacherBusy.set(id, [...spans])
  const classSlots = new Set(ctx.existingClassSlots)

  for (const row of rows) {
    let failed = false
    const fail = (message: string) => {
      errors.push({ row: row.rowNumber, message })
      failed = true
    }

    const className = row.className.trim()
    if (!className) {
      fail('학급이 비어 있습니다')
      continue
    }
    const cls = ctx.classesByName.get(className)
    if (!cls) {
      fail(`학급 "${className}"을 찾을 수 없습니다`)
      continue
    }

    const day = DAY_LABELS[row.dayLabel.trim()]
    if (!day) {
      fail(`요일 "${row.dayLabel}"을 알 수 없습니다 (월~금)`)
      continue
    }

    const periodNo = Number(row.periodNo.trim())
    if (!Number.isInteger(periodNo) || periodNo < 1) {
      fail(`교시 "${row.periodNo}"가 올바르지 않습니다`)
      continue
    }

    const periodDef = (ctx.periodsByCourse.get(cls.course) ?? []).find((p) => p.no === periodNo)
    if (!periodDef) {
      fail(`${className} 학급 과정에는 ${periodNo}교시 시정이 없습니다`)
      continue
    }

    const teacherName = row.teacherName.trim()
    if (!teacherName) {
      fail('담당교사가 비어 있습니다')
      continue
    }
    const teacher = resolveTeacher(ctx, teacherName, '담당', fail)
    if (!teacher) continue

    let coTeacher: { id: string; name: string } | null = null
    const coTeacherName = row.coTeacherName.trim()
    if (coTeacherName) {
      coTeacher = resolveTeacher(ctx, coTeacherName, '협력', fail)
      if (failed) continue
      if (coTeacher && coTeacher.id === teacher.id) {
        fail('협력교사는 담당교사와 달라야 합니다')
        continue
      }
    }

    const subjectName = row.subjectName.trim()
    let subjectId: string | null = null
    if (subjectName) {
      subjectId = ctx.subjectsByName.get(subjectName) ?? null
      if (!subjectId) {
        fail(`교과 "${subjectName}"를 찾을 수 없습니다`)
        continue
      }
    }

    const roomName = row.roomName.trim()
    let roomId: string | null = null
    if (roomName) {
      roomId = ctx.roomsByName.get(roomName) ?? null
      if (!roomId) {
        fail(`특별실 "${roomName}"를 찾을 수 없습니다`)
        continue
      }
    }

    const classKey = `${cls.id}:${day}:${periodNo}`
    if (classSlots.has(classKey)) {
      fail(`${className}은 ${row.dayLabel} ${periodNo}교시에 이미 시간표가 있습니다`)
      continue
    }

    const span = { startsMin: periodDef.start, endsMin: periodDef.end }
    const people = coTeacher ? [teacher, coTeacher] : [teacher]
    let clash = false
    for (const person of people) {
      const busy = teacherBusy.get(person.id) ?? []
      const hit = busy.find((b) => b.day === day && overlaps(span, { startsMin: b.start, endsMin: b.end }))
      if (hit) {
        fail(`${person.name} 선생님은 ${row.dayLabel}요일 그 시간에 이미 다른 수업이 있습니다`)
        clash = true
        break
      }
    }
    if (clash) continue

    classSlots.add(classKey)
    for (const person of people) {
      const busy = teacherBusy.get(person.id) ?? []
      busy.push({ day, start: span.startsMin, end: span.endsMin })
      teacherBusy.set(person.id, busy)
    }

    valid.push({
      course: cls.course,
      day_of_week: day,
      period_no: periodNo,
      class_id: cls.id,
      teacher_id: teacher.id,
      co_teacher_id: coTeacher?.id ?? null,
      subject_id: subjectId,
      room_id: roomId,
    })
  }

  return { valid, errors }
}
