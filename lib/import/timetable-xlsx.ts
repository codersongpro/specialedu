import 'server-only'

import ExcelJS from 'exceljs'
import { TIMETABLE_TEMPLATE_HEADERS, type RawTimetableRow } from './timetable'

/**
 * 셀 값을 문자열로 통일한다.
 *
 * 엑셀은 "="로 시작하는 텍스트를 사람이 그렇게 입력하지 않아도 수식으로
 * 저장하는 경우가 있다(자동 서식). exceljs로 읽으면 그런 셀은 문자열이
 * 아니라 `{formula, result}` 객체로 온다 — result를 우선 쓰고, 없으면
 * 빈 값으로 취급해 그대로 문자열 취급했을 때 "[object Object]"가
 * 담당교사 이름 자리에 들어가는 것을 막는다.
 */
function cellText(value: ExcelJS.CellValue): string {
  if (value == null) return ''
  if (value instanceof Date) return value.toISOString().slice(0, 10)
  if (typeof value === 'object') {
    if ('result' in value && value.result != null) return cellText(value.result)
    if ('richText' in value) {
      return (value.richText as Array<{ text: string }>).map((t) => t.text).join('')
    }
    return ''
  }
  return String(value).trim()
}

export async function buildTimetableTemplate(classNames: readonly string[]): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook()

  const sheet = workbook.addWorksheet('시간표')
  sheet.addRow([...TIMETABLE_TEMPLATE_HEADERS])
  sheet.getRow(1).font = { bold: true }
  sheet.columns = TIMETABLE_TEMPLATE_HEADERS.map((header) => ({
    width: header.includes('선택') ? 18 : 14,
  }))
  // 채워 넣는 방법을 보여주는 예시 한 줄
  if (classNames[0]) {
    sheet.addRow([classNames[0], '월', 1, '', '', '', ''])
  }

  const guide = workbook.addWorksheet('안내')
  guide.addRow(['이 시트는 참고용입니다. 실제로 올릴 시트는 "시간표" 한 장뿐입니다.'])
  guide.addRow([])
  guide.addRow(['요일은 월/화/수/목/금 중 하나로 적습니다.'])
  guide.addRow(['교시는 숫자만 적습니다 (해당 학급 과정의 시정표에 있는 교시여야 합니다).'])
  guide.addRow(['담당교사·협력교사는 이 학교 교직원 이름을 그대로 적습니다.'])
  guide.addRow(['교과·특별실은 비워 둬도 됩니다.'])
  guide.addRow([])
  guide.addRow(['이 학교에 등록된 학급:'])
  for (const name of classNames) guide.addRow([name])

  const buffer = await workbook.xlsx.writeBuffer()
  return Buffer.from(buffer)
}

export async function readTimetableWorkbook(buffer: ArrayBuffer): Promise<RawTimetableRow[]> {
  const workbook = new ExcelJS.Workbook()
  await workbook.xlsx.load(buffer)
  const sheet = workbook.worksheets[0]
  if (!sheet) return []

  const rows: RawTimetableRow[] = []
  sheet.eachRow((row, rowNumber) => {
    if (rowNumber === 1) return // 머리글
    const values = row.values as ExcelJS.CellValue[] // 1-based, values[0]은 비어 있음
    const get = (i: number) => cellText(values[i])

    const className = get(1)
    const dayLabel = get(2)
    const periodNo = get(3)
    const teacherName = get(5)
    // 완전히 빈 줄은 건너뛴다
    if (!className && !dayLabel && !periodNo && !teacherName) return

    rows.push({
      rowNumber,
      className,
      dayLabel,
      periodNo,
      subjectName: get(4),
      teacherName,
      coTeacherName: get(6),
      roomName: get(7),
    })
  })

  return rows
}
