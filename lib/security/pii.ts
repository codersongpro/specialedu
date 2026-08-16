/**
 * 개인정보 마스킹 왕복.
 *
 * 무료 Gemini API 는 전송한 내용이 학습에 쓰일 수 있다. 유료로 올리는 대신
 * 개인정보가 애초에 Google 에 도달하지 않게 막는다.
 *
 *   원문:  김민수 학생은 3월 5일 체험학습에 참여합니다. 문의 010-1234-5678
 *   전송:  [[P1]] 학생은 3월 5일 체험학습에 참여합니다. 문의 [[P2]]
 *   복원:  김민수 학생은 3월 5일에 체험학습을 갑니다. 궁금하면 010-1234-5678로 전화하세요.
 *
 * 한계를 분명히 해 둔다: 학생 이름은 자동으로 100% 잡을 수 없다.
 * 가명처리 원칙상 앱에 학생 명렬표가 없어 대조할 사전이 없기 때문이다.
 * 그래서 'suspect' 로 표시해 사람이 확인하는 단계를 반드시 거치게 한다.
 */

export type PiiKind =
  | 'rrn'          // 주민등록번호
  | 'account'      // 계좌번호
  | 'phone'        // 전화·휴대폰
  | 'email'
  | 'staff_name'   // 교직원 명단 대조
  | 'org_name'     // 학교·부서명
  | 'suspected_name'

export type Confidence = 'certain' | 'suspect'

export interface Finding {
  token: string
  original: string
  kind: PiiKind
  confidence: Confidence
  start: number
  end: number
}

export interface MaskOptions {
  /** 교직원 이름. 앱에 명단이 있으므로 확실하게 잡을 수 있다. */
  staffNames?: string[]
  /** 학교명·부서명 */
  orgNames?: string[]
  /** 사람이 확인 화면에서 "이건 개인정보 아님"으로 푼 구간 */
  allowlist?: string[]
}

export interface MaskResult {
  masked: string
  /** 토큰 → 원문. 요청 메모리에만 두고 DB·로그에 남기지 않는다. */
  tokens: Record<string, string>
  findings: Finding[]
}

/** 사람이 풀어줘도 전송을 막는 항목. 유출 시 피해가 회복 불가능하다. */
const NEVER_SEND: PiiKind[] = ['rrn', 'account']

/**
 * 순서가 중요하다. 앞선 패턴이 같은 구간을 선점한다.
 * 전화번호를 계좌번호보다 먼저 두어야 010-1234-5678 이 계좌로 오인되지 않는다.
 */
const PATTERNS: Array<{ kind: PiiKind; confidence: Confidence; re: RegExp }> = [
  // 주민등록번호 — 뒷자리 첫 숫자는 1~4(내국인) 또는 5~8(외국인)
  { kind: 'rrn', confidence: 'certain', re: /\b\d{6}\s*[-–]\s*[1-8]\d{6}\b/g },
  { kind: 'email', confidence: 'certain', re: /\b[\w.+-]+@[\w-]+\.[\w.-]+\b/g },
  // 휴대폰
  { kind: 'phone', confidence: 'certain', re: /\b01[016789][-\s.]?\d{3,4}[-\s.]?\d{4}\b/g },
  // 일반전화 (지역번호 02 포함)
  { kind: 'phone', confidence: 'certain', re: /\b0(?:2|[3-6][1-5])[-\s.]?\d{3,4}[-\s.]?\d{4}\b/g },
  // 계좌번호 — 숫자가 하이픈으로 끊긴 형태. 전화번호를 먼저 걸러낸 뒤에 본다.
  { kind: 'account', confidence: 'certain', re: /\b\d{2,6}-\d{2,6}-\d{2,7}\b/g },
  // 한국 이름으로 보이는 구간 — 호칭이 붙은 경우만
  {
    kind: 'suspected_name',
    confidence: 'suspect',
    re: /[가-힣]{2,4}(?=\s*(?:학생|어린이|님|씨|군|양|선생님|담임|어머니|아버지|학부모|보호자))/g,
  },
]

/** 날짜(2026-03-09)가 계좌번호로 잡히는 것을 막는다 */
function looksLikeDate(text: string): boolean {
  return /^(19|20)\d{2}-\d{1,2}-\d{1,2}$/.test(text)
}

/**
 * 이름 휴리스틱의 오탐을 걸러낸다.
 *
 * "학생의 보호자"에서 '학생의'가, "김하늘 선생님"에서 '선생'이 이름으로 잡힌다.
 * 이걸 그대로 치환하면 문장이 망가지고, 교사는 확인 화면에서 매번 풀어야 한다.
 */
const NAME_STOPWORDS = new Set([
  '학생', '학부모', '보호자', '선생', '담임', '교사', '부모', '자녀', '아동', '어린이',
  '우리', '저희', '모든', '전체', '해당', '각반', '오늘', '내일', '어제', '가정',
])

/** 조사를 떼고 본다. '학생의' → '학생' */
const TRAILING_PARTICLE = /[의과와은는이가을를도만에로께]$/

function isLikelyNotAName(candidate: string): boolean {
  if (NAME_STOPWORDS.has(candidate)) return true
  const stem = candidate.replace(TRAILING_PARTICLE, '')
  return stem.length >= 2 && NAME_STOPWORDS.has(stem)
}

export function maskPII(text: string, opts: MaskOptions = {}): MaskResult {
  const allow = new Set(opts.allowlist ?? [])
  const raw: Array<Omit<Finding, 'token'>> = []

  for (const { kind, confidence, re } of PATTERNS) {
    for (const match of text.matchAll(re)) {
      const value = match[0]
      const start = match.index ?? 0
      if (allow.has(value)) continue
      if (kind === 'account' && looksLikeDate(value)) continue
      if (kind === 'suspected_name' && isLikelyNotAName(value)) continue
      raw.push({ original: value, kind, confidence, start, end: start + value.length })
    }
  }

  // 명단 대조 — 이쪽은 확실하다
  for (const [names, kind] of [
    [opts.staffNames ?? [], 'staff_name'],
    [opts.orgNames ?? [], 'org_name'],
  ] as const) {
    for (const name of names) {
      if (!name || name.length < 2 || allow.has(name)) continue
      let from = 0
      for (;;) {
        const at = text.indexOf(name, from)
        if (at === -1) break
        raw.push({
          original: name,
          kind,
          confidence: 'certain',
          start: at,
          end: at + name.length,
        })
        from = at + name.length
      }
    }
  }

  // 겹치는 구간은 하나만 남긴다. 더 길게 잡힌 쪽(구체적인 쪽)을 우선한다.
  raw.sort((a, b) => a.start - b.start || b.end - b.start - (a.end - a.start))
  const kept: Array<Omit<Finding, 'token'>> = []
  let cursor = -1
  for (const item of raw) {
    if (item.start < cursor) continue
    kept.push(item)
    cursor = item.end
  }

  // 같은 문자열은 같은 토큰을 쓴다. "김민수"가 세 번 나오면 전부 [[P1]].
  const tokenByValue = new Map<string, string>()
  const tokens: Record<string, string> = {}
  const findings: Finding[] = []

  for (const item of kept) {
    let token = tokenByValue.get(item.original)
    if (!token) {
      token = `[[P${tokenByValue.size + 1}]]`
      tokenByValue.set(item.original, token)
      tokens[token] = item.original
    }
    findings.push({ ...item, token })
  }

  // 뒤에서부터 치환해야 앞쪽 인덱스가 밀리지 않는다.
  let masked = text
  for (const finding of [...findings].sort((a, b) => b.start - a.start)) {
    masked = masked.slice(0, finding.start) + finding.token + masked.slice(finding.end)
  }

  return { masked, tokens, findings }
}

/**
 * 여러 입력 필드를 한 번에 마스킹한다.
 *
 * maskPII()를 필드별로 따로 호출하면 토큰 번호([[P1]], [[P2]]...)가 호출마다
 * 새로 매겨져 필드 사이에서 충돌한다 — 제목의 [[P1]]과 상세의 [[P1]]이 서로
 * 다른 원문을 가리키게 되어 restorePII()가 엉뚱하게 복원해 버린다. 구분자로
 * 이어붙여 한 번만 마스킹한 뒤 다시 나누면 토큰이 전 필드에서 유일해진다.
 */
export function maskFields<K extends string>(
  fields: Record<K, string>,
  opts: MaskOptions = {},
): MaskResult & { fields: Record<K, string> } {
  const keys = Object.keys(fields) as K[]
  // 입력 텍스트에 실제로 나타날 일이 없는 구분자. 개행으로 감싸 패턴이
  // 필드 경계를 넘어 매칭되는 것도 함께 막는다(예: 전화번호가 두 필드에 걸쳐 이어짐).
  const SEP = '\n␟\n'
  const combined = keys.map((k) => fields[k]).join(SEP)
  const result = maskPII(combined, opts)
  const parts = result.masked.split(SEP)

  const maskedFields = {} as Record<K, string>
  keys.forEach((key, i) => {
    maskedFields[key] = parts[i] ?? ''
  })

  return { ...result, fields: maskedFields }
}

export interface RestoreResult {
  text: string
  /** 모델이 없애버린 토큰. 하나라도 있으면 복원이 불완전하다. */
  missing: string[]
}

export function restorePII(masked: string, tokens: Record<string, string>): RestoreResult {
  let text = masked
  const missing: string[] = []

  for (const [token, original] of Object.entries(tokens)) {
    if (!text.includes(token)) {
      missing.push(token)
      continue
    }
    text = text.split(token).join(original)
  }

  return { text, missing }
}

/**
 * 전송을 무조건 막아야 하는 항목이 남아 있는지.
 * 사람이 확인 화면에서 풀어주더라도 이건 우회할 수 없다.
 */
export function blockedFindings(findings: readonly Finding[]): Finding[] {
  return findings.filter((f) => NEVER_SEND.includes(f.kind))
}

/** 마스킹을 마친 뒤에도 남아 있는 위험 패턴 — 전송 직전 마지막 확인 */
export function scanForBlocked(text: string): Finding[] {
  const result = maskPII(text)
  return blockedFindings(result.findings)
}

export const PII_KIND_LABEL: Record<PiiKind, string> = {
  rrn: '주민등록번호',
  account: '계좌번호',
  phone: '전화번호',
  email: '이메일',
  staff_name: '교직원 이름',
  org_name: '학교·부서명',
  suspected_name: '이름으로 보이는 부분',
}
