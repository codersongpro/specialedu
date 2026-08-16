import { describe, expect, it } from 'vitest'
import { validateLessonUpload } from '@/lib/lesson-adapt/upload'

describe('수준별 수업 변환기 첨부파일 검사', () => {
  it('PNG는 MIME, 확장자, 매직바이트가 모두 맞아야 허용한다', () => {
    expect(
      validateLessonUpload({
        name: '활동지.png',
        type: 'image/png',
        size: 1024,
        bytes: new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
      }),
    ).toEqual({ ok: true, mimeType: 'image/png' })
  })

  it('확장자만 PNG인 위장 파일은 거절한다', () => {
    expect(
      validateLessonUpload({
        name: '활동지.png',
        type: 'image/png',
        size: 1024,
        bytes: new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d]),
      }),
    ).toEqual({ ok: false, error: '파일 형식을 확인할 수 없습니다' })
  })

  it('20쪽을 넘는 PDF는 거절한다', () => {
    const pages = Array.from({ length: 21 }, () => '/Type /Page').join('\n')
    const bytes = new TextEncoder().encode(`%PDF-1.7\n${pages}`)

    expect(
      validateLessonUpload({ name: '수업자료.pdf', type: 'application/pdf', size: bytes.length, bytes }),
    ).toEqual({ ok: false, error: 'PDF는 20쪽 이하만 올릴 수 있습니다' })
  })
})
