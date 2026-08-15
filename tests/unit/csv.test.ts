import { describe, expect, it } from 'vitest'
import { escapeCell, toCsv } from '@/lib/export/csv'

describe('CSV 수식 인젝션 방지', () => {
  it('수식으로 해석될 수 있는 셀 앞에 작은따옴표를 붙인다', () => {
    expect(escapeCell('=1+1')).toBe("'=1+1")
    expect(escapeCell('+SUM(A1)')).toBe("'+SUM(A1)")
    expect(escapeCell('-2')).toBe("'-2")
    expect(escapeCell('@import')).toBe("'@import")
  })

  it('실제 위험한 페이로드를 글자로 못 박는다', () => {
    const payload = '=cmd|\'/c calc\'!A1'
    expect(escapeCell(payload).startsWith("'=")).toBe(true)
  })

  it('평범한 값은 건드리지 않는다', () => {
    expect(escapeCell('김하늘')).toBe('김하늘')
    expect(escapeCell(3)).toBe('3')
    expect(escapeCell(null)).toBe('')
  })
})

describe('CSV 형식', () => {
  it('쉼표와 큰따옴표를 감싼다', () => {
    expect(escapeCell('가, 나')).toBe('"가, 나"')
    expect(escapeCell('그는 "안녕"이라 했다')).toBe('"그는 ""안녕""이라 했다"')
  })

  it('줄바꿈이 든 값도 한 셀로 유지한다', () => {
    expect(escapeCell('첫줄\n둘째줄')).toBe('"첫줄\n둘째줄"')
  })

  it('한글이 깨지지 않게 BOM 을 붙인다', () => {
    const csv = toCsv(['이름'], [['김하늘']])
    expect(csv.startsWith('﻿')).toBe(true)
    expect(csv).toContain('김하늘')
  })

  it('헤더와 행을 CRLF 로 잇는다', () => {
    expect(toCsv(['a', 'b'], [[1, 2]])).toBe('﻿a,b\r\n1,2')
  })
})
