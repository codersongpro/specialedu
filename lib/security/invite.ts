import 'server-only'

import { createHash, randomBytes, timingSafeEqual } from 'node:crypto'

/**
 * 초대 토큰.
 *
 * 평문은 메일로만 나가고 DB 에는 해시만 남는다. DB 가 유출되어도
 * 그 토큰으로 가입할 수는 없다.
 */

export function createInviteToken(): { token: string; hash: string } {
  const token = randomBytes(32).toString('base64url')
  return { token, hash: hashInviteToken(token) }
}

export function hashInviteToken(token: string): string {
  return createHash('sha256').update(token).digest('hex')
}

export function tokensMatch(a: string, b: string): boolean {
  const bufA = Buffer.from(a)
  const bufB = Buffer.from(b)
  if (bufA.length !== bufB.length) return false
  return timingSafeEqual(bufA, bufB)
}

/** 초대 유효기간. 짧게 잡아야 메일함에 남은 링크로 나중에 가입되는 일이 없다. */
export const INVITE_TTL_HOURS = 72

export function inviteExpiryFrom(now: Date = new Date()): Date {
  return new Date(now.getTime() + INVITE_TTL_HOURS * 60 * 60 * 1000)
}
