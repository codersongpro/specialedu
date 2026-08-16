export const MAX_LESSON_UPLOADS = 3
const MAX_BYTES = 10 * 1024 * 1024
const MAX_PDF_PAGES = 20

type UploadInput = {
  name: string
  type: string
  size: number
  bytes: Uint8Array
}

type UploadResult = { ok: true; mimeType: 'application/pdf' | 'image/png' | 'image/jpeg' | 'image/webp' } | { ok: false; error: string }

const EXTENSION_MIME = {
  pdf: 'application/pdf',
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  webp: 'image/webp',
} as const

function matches(bytes: Uint8Array, expected: number[], offset = 0): boolean {
  return expected.every((byte, index) => bytes[offset + index] === byte)
}

function pageCount(bytes: Uint8Array): number {
  const text = new TextDecoder('latin1').decode(bytes)
  return (text.match(/\/Type\s*\/Page\b/g) ?? []).length
}

export function validateLessonUpload(input: UploadInput): UploadResult {
  if (input.size <= 0 || input.size > MAX_BYTES) return { ok: false, error: '파일은 10MB 이하만 올릴 수 있습니다' }

  const extension = input.name.toLowerCase().split('.').pop()
  const expectedMime = extension ? EXTENSION_MIME[extension as keyof typeof EXTENSION_MIME] : undefined
  if (!expectedMime || input.type !== expectedMime) return { ok: false, error: '허용하지 않는 파일 형식입니다' }

  const mimeType =
    matches(input.bytes, [0x25, 0x50, 0x44, 0x46, 0x2d])
      ? 'application/pdf'
      : matches(input.bytes, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])
        ? 'image/png'
        : matches(input.bytes, [0xff, 0xd8, 0xff])
          ? 'image/jpeg'
          : matches(input.bytes, [0x52, 0x49, 0x46, 0x46]) && matches(input.bytes, [0x57, 0x45, 0x42, 0x50], 8)
            ? 'image/webp'
            : null

  if (!mimeType || mimeType !== expectedMime) return { ok: false, error: '파일 형식을 확인할 수 없습니다' }
  if (mimeType === 'application/pdf' && pageCount(input.bytes) > MAX_PDF_PAGES) {
    return { ok: false, error: 'PDF는 20쪽 이하만 올릴 수 있습니다' }
  }

  return { ok: true, mimeType }
}
