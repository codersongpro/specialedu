/**
 * 시각은 전부 "자정부터의 분(minute)"으로 다룬다.
 *
 * 이유: 특수학교는 한 건물에서 초·중·고·전공과가 서로 다른 시정표로 돌아간다.
 * 초등 3교시(10:40~11:20)와 고등 3교시(11:00~11:50)는 다른 시각이므로,
 * 교시 번호로 충돌을 비교하면 실제로 겹치는 배정을 통과시켜 버린다.
 * 이 파일의 함수만 거치면 그 실수를 구조적으로 막을 수 있다.
 */

export interface TimeSpan {
  startsMin: number
  endsMin: number
}

/** "09:30" → 570 */
export function toMinutes(hhmm: string): number {
  const m = /^(\d{1,2}):(\d{2})$/.exec(hhmm.trim())
  if (!m) throw new Error(`시각 형식이 올바르지 않습니다: ${hhmm}`)
  const hours = Number(m[1])
  const mins = Number(m[2])
  if (hours > 24 || mins > 59) throw new Error(`시각 범위를 벗어났습니다: ${hhmm}`)
  return hours * 60 + mins
}

/** 570 → "09:30" */
export function toHHMM(minutes: number): string {
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
}

export function formatSpan(span: TimeSpan): string {
  return `${toHHMM(span.startsMin)}–${toHHMM(span.endsMin)}`
}

/**
 * 두 구간이 겹치는지.
 *
 * 경계는 열린 구간으로 본다 — 10:00에 끝나는 수업과 10:00에 시작하는 수업은
 * 겹치지 않는다. 이게 아니면 연속 교시가 전부 충돌로 잡힌다.
 */
export function overlaps(a: TimeSpan, b: TimeSpan): boolean {
  return a.startsMin < b.endsMin && b.startsMin < a.endsMin
}

export function overlapsAny(span: TimeSpan, others: readonly TimeSpan[]): boolean {
  return others.some((other) => overlaps(span, other))
}

/**
 * 연속으로 이어지는 교시 묶음 중 가장 긴 길이.
 * 결보강을 배정했을 때 특정 교사에게 연강이 몰리는지 판단하는 데 쓴다.
 */
export function longestRun(periodNumbers: readonly number[]): number {
  if (periodNumbers.length === 0) return 0
  const sorted = [...new Set(periodNumbers)].sort((a, b) => a - b)
  let best = 1
  let run = 1
  for (let i = 1; i < sorted.length; i += 1) {
    const prev = sorted[i - 1]
    const cur = sorted[i]
    if (prev === undefined || cur === undefined) continue
    if (cur === prev + 1) {
      run += 1
      best = Math.max(best, run)
    } else {
      run = 1
    }
  }
  return best
}

/** 특정 교시를 포함하는 연속 묶음의 길이 */
export function runLengthContaining(periodNumbers: readonly number[], target: number): number {
  const set = new Set(periodNumbers)
  set.add(target)
  let length = 1
  for (let p = target - 1; set.has(p); p -= 1) length += 1
  for (let p = target + 1; set.has(p); p += 1) length += 1
  return length
}
