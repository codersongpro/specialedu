/**
 * CSV 만들기.
 *
 * 엑셀은 =, +, -, @ 로 시작하는 셀을 수식으로 해석한다. 결보강 메모에
 * "=1+1" 같은 글자가 들어 있으면 계산식이 되고, 악의적으로 쓰면
 * 외부 명령을 실행시키는 통로가 된다 (CSV injection).
 * 그래서 앞에 작은따옴표를 붙여 글자로 못 박는다.
 */

const RISKY_PREFIX = /^[=+\-@\t\r]/

export function escapeCell(value: unknown): string {
  if (value == null) return ''
  let text = String(value)

  if (RISKY_PREFIX.test(text)) {
    text = `'${text}`
  }

  if (/[",\n\r]/.test(text)) {
    return `"${text.replace(/"/g, '""')}"`
  }
  return text
}

export function toCsv(headers: readonly string[], rows: readonly unknown[][]): string {
  const lines = [headers.map(escapeCell).join(',')]
  for (const row of rows) {
    lines.push(row.map(escapeCell).join(','))
  }
  // 엑셀이 UTF-8 을 알아보게 BOM 을 붙인다. 없으면 한글이 깨진다.
  return `﻿${lines.join('\r\n')}`
}

export function csvResponse(filename: string, body: string): Response {
  return new Response(body, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename*=UTF-8''${encodeURIComponent(filename)}`,
      'Cache-Control': 'no-store',
    },
  })
}
