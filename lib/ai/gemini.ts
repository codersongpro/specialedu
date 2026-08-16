import 'server-only'

/**
 * Gemini 호출 — 이 앱에서 Gemini API 를 실제로 부르는 코드가 모여 있다.
 *
 * 서버에서만 부르고, API 키는 호출부(각 기능의 actions.ts)에서 복호화해
 * 인자로 넘긴다 — 이 파일은 키를 저장하거나 로그로 남기지 않는다.
 * 프롬프트·응답 원문도 로그에 남기지 않는다(ai_usage_logs 에는 "성공했는지,
 * 어떤 키를 썼는지"만 남는다).
 */

const MODEL = process.env.GEMINI_MODEL || 'gemini-2.5-flash'

async function callGemini(
  apiKey: string,
  parts: Array<{ text: string } | { inline_data: { mime_type: string; data: string } }>,
): Promise<string> {
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${encodeURIComponent(apiKey)}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts }],
        generationConfig: { responseMimeType: 'application/json' },
      }),
    },
  )

  if (!res.ok) {
    throw new Error(`Gemini 호출 실패 (${res.status})`)
  }

  const body = (await res.json()) as {
    candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>
  }
  const text = body.candidates?.[0]?.content?.parts?.[0]?.text
  if (!text) throw new Error('Gemini 응답을 읽을 수 없습니다')
  return text
}

function parseJsonRecord(text: string): Record<string, unknown> {
  let parsed: unknown
  try {
    parsed = JSON.parse(text)
  } catch {
    throw new Error('Gemini 응답 형식이 올바르지 않습니다')
  }
  if (typeof parsed !== 'object' || parsed === null) {
    throw new Error('Gemini 응답 형식이 올바르지 않습니다')
  }
  return parsed as Record<string, unknown>
}

export interface ReceiptExtraction {
  amount: number | null
  date: string | null // YYYY-MM-DD
  vendor: string | null
}

/** 영수증 사진에서 금액·날짜·상호명을 읽는다(예산 > 지출 등록에서 사용). */
export async function extractReceiptFields(
  apiKey: string,
  imageBase64: string,
  mimeType: string,
): Promise<ReceiptExtraction> {
  const prompt =
    '이 이미지는 한국의 영수증 또는 지출 증빙입니다. 다음 JSON 형식으로만 답하세요. ' +
    '확실하지 않은 값은 null로 두세요.\n' +
    '{"amount": 합계금액(숫자만, 콤마·원 표시 제외), "date": "YYYY-MM-DD", "vendor": "상호명"}'

  const text = await callGemini(apiKey, [
    { text: prompt },
    { inline_data: { mime_type: mimeType, data: imageBase64 } },
  ])
  const record = parseJsonRecord(text)

  return {
    amount:
      typeof record.amount === 'number' && Number.isFinite(record.amount) ? Math.round(record.amount) : null,
    date:
      typeof record.date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(record.date) ? record.date : null,
    vendor: typeof record.vendor === 'string' ? record.vendor.slice(0, 100) : null,
  }
}

export type EasyReadLevel = 1 | 2 | 3

const LEVEL_INSTRUCTION: Record<EasyReadLevel, string> = {
  1: '한 문장은 3~5어절로 아주 짧게 씁니다. 그림으로 나타내기 좋은 쉬운 낱말만 씁니다.',
  2: '짧은 문장과 쉬운 낱말을 씁니다. 어려운 한자어는 쉬운 말로 풀어 씁니다.',
  3: '문장을 자연스럽게 다듬기만 하고, 표현 수준은 원문과 비슷하게 유지합니다.',
}

export interface EasyReadInput {
  noticeType: string
  title: string
  date: string | null
  place: string | null
  items: string[]
  audience: string
  level: EasyReadLevel
  /** 이미 마스킹된 안내사항 — [[P1]] 같은 토큰이 그대로 남아 있어야 한다 */
  detail: string
}

export interface EasyReadResult {
  text: string
  keywords: string[]
}

/**
 * 쉬운글 안내문 생성.
 *
 * 프롬프트에 [[P1]] 형태 토큰을 절대 바꾸지 말라고 명시한다 — 호출부가
 * 이 토큰을 실제 개인정보로 다시 채워 넣는다(restorePII). 토큰이
 * 사라지면 복원이 안 되므로 호출부에서 반드시 실패 처리해야 한다.
 */
export async function generateEasyRead(apiKey: string, input: EasyReadInput): Promise<EasyReadResult> {
  const lines = [
    `종류: ${input.noticeType}`,
    `제목: ${input.title}`,
    input.date ? `날짜: ${input.date}` : null,
    input.place ? `장소: ${input.place}` : null,
    input.items.length > 0 ? `준비물: ${input.items.join(', ')}` : null,
    `대상: ${input.audience}`,
    `안내사항: ${input.detail}`,
  ].filter(Boolean)

  const prompt = `다음 학교 안내문을 발달장애 학생도 이해하기 쉽게 다시 씁니다.
${LEVEL_INSTRUCTION[input.level]}
문장에 [[P1]], [[P2]] 같은 대괄호 토큰이 보이면 절대 지우거나 바꾸지 말고 그 형태 그대로 남겨 두세요.

${lines.join('\n')}

다음 JSON 형식으로만 답하세요:
{"text": "제목·날짜·장소·준비물을 자연스럽게 포함한 안내문 전체", "keywords": ["핵심 낱말 3~6개(그림으로 나타낼 수 있는 명사 위주, 한 단어씩)"]}`

  const text = await callGemini(apiKey, [{ text: prompt }])
  const record = parseJsonRecord(text)

  const resultText = typeof record.text === 'string' ? record.text : ''
  if (!resultText) throw new Error('Gemini 응답을 읽을 수 없습니다')

  const keywords = Array.isArray(record.keywords)
    ? record.keywords.filter((k): k is string => typeof k === 'string').slice(0, 6)
    : []

  return { text: resultText, keywords }
}

export interface MediaSearchInput {
  course: string
  level: EasyReadLevel
  topic: string
  subject: string | null
}

/** 유튜브 검색어 후보 생성(수업 자료 찾기에서 사용). 학생 이름 등은 애초에 입력받지 않는다. */
export async function generateSearchTerms(apiKey: string, input: MediaSearchInput): Promise<string[]> {
  const prompt = `특수학교 수업에 쓸 유튜브 영상을 찾으려 합니다. 아래 조건에 맞는
검색어를 3~5개 만들어 주세요. 실제 유튜브에서 검색할 한국어 검색어입니다.

과정: ${input.course}
학생 수준: ${input.level}단계(1이 가장 쉬움)
${input.subject ? `교과: ${input.subject}` : ''}
제재·주제: ${input.topic}

다음 JSON 형식으로만 답하세요:
{"queries": ["검색어1", "검색어2", "검색어3"]}`

  const text = await callGemini(apiKey, [{ text: prompt }])
  const record = parseJsonRecord(text)
  const queries = Array.isArray(record.queries)
    ? record.queries.filter((q): q is string => typeof q === 'string' && q.trim().length > 0)
    : []
  if (queries.length === 0) throw new Error('검색어를 만들지 못했습니다')
  return queries.slice(0, 5)
}
