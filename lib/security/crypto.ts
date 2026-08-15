import 'server-only'

import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto'

/**
 * Gemini API 키 암호화 저장.
 *
 * 교직원이 개인 키를 등록하면 평문으로 두지 않고 AES-256-GCM 으로 암호화한다.
 * 복호화 키는 DB 가 아니라 환경변수에 있으므로, DB 만 유출되면 키는 못 읽는다.
 *
 * 저장 형식: v1.<iv>.<authTag>.<ciphertext> (각 부분 base64url)
 */

const VERSION = 'v1'

function masterKey(): Buffer {
  const raw = process.env.GEMINI_KEY_ENCRYPTION_KEY
  if (!raw) {
    throw new Error(
      'GEMINI_KEY_ENCRYPTION_KEY 가 없습니다. `openssl rand -base64 32` 로 만들어 환경변수에 넣으세요.',
    )
  }
  const key = Buffer.from(raw, 'base64')
  if (key.length !== 32) {
    throw new Error('GEMINI_KEY_ENCRYPTION_KEY 는 base64 로 인코딩한 32바이트여야 합니다')
  }
  return key
}

export function encryptSecret(plaintext: string): string {
  const iv = randomBytes(12)
  const cipher = createCipheriv('aes-256-gcm', masterKey(), iv)
  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()])
  const tag = cipher.getAuthTag()

  return [
    VERSION,
    iv.toString('base64url'),
    tag.toString('base64url'),
    encrypted.toString('base64url'),
  ].join('.')
}

export function decryptSecret(stored: string): string {
  const [version, ivPart, tagPart, dataPart] = stored.split('.')
  if (version !== VERSION || !ivPart || !tagPart || !dataPart) {
    throw new Error('저장된 키 형식이 올바르지 않습니다')
  }

  const decipher = createDecipheriv(
    'aes-256-gcm',
    masterKey(),
    Buffer.from(ivPart, 'base64url'),
  )
  decipher.setAuthTag(Buffer.from(tagPart, 'base64url'))

  return Buffer.concat([
    decipher.update(Buffer.from(dataPart, 'base64url')),
    decipher.final(),
  ]).toString('utf8')
}

/**
 * 화면에 보여줄 힌트. 키 자체는 한 번 저장하면 다시 못 본다.
 * 교사가 "내가 등록한 그 키가 맞나" 정도만 확인할 수 있으면 된다.
 */
export function keyHint(plaintext: string): string {
  const tail = plaintext.slice(-4)
  return `••••${tail}`
}

/** 로그·에러 리포트에 키가 통째로 찍히지 않게 */
export function redactSecrets(text: string): string {
  return text.replace(/AIza[\w-]{20,}/g, 'AIza••••[redacted]')
}
