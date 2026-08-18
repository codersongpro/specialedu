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

export interface MeetingNoteSummaryInput {
  title: string
  category: string | null
  /** 이미 마스킹된 회의 원문 — [[P1]] 같은 토큰이 그대로 남아 있어야 한다 */
  rawText: string
}

/** 협의록 요약 — 결정사항·담당자·기한 위주로 짧게 정리한다. */
export async function summarizeMeetingNotes(apiKey: string, input: MeetingNoteSummaryInput): Promise<string> {
  const prompt = `다음은 학교 협의회·회의 기록입니다. 결정사항·담당자·기한을 중심으로
5줄 이내로 요약하세요. 문장에 [[P1]], [[P2]] 같은 대괄호 토큰이 보이면 절대
지우거나 바꾸지 말고 그 형태 그대로 남겨 두세요.

제목: ${input.title}
${input.category ? `구분: ${input.category}` : ''}
내용: ${input.rawText}

다음 JSON 형식으로만 답하세요:
{"summary": "결정사항·담당자·기한 위주 요약, 5줄 이내"}`

  const text = await callGemini(apiKey, [{ text: prompt }])
  const record = parseJsonRecord(text)
  const summary = typeof record.summary === 'string' ? record.summary : ''
  if (!summary) throw new Error('Gemini 응답을 읽을 수 없습니다')
  return summary
}

export interface IepGoalDraftInput {
  areaLabel: string
  /** 이미 마스킹된 현재 수준 설명 — [[P1]] 같은 토큰이 그대로 남아 있어야 한다 */
  currentLevel: string
}

/** IEP 목표 초안 — 관찰·측정 가능한 행동 목표 문장 후보 2~3개를 만든다. */
export async function draftIepGoals(apiKey: string, input: IepGoalDraftInput): Promise<string[]> {
  const prompt = `특수교육 IEP(개별화교육계획) 목표 문장 초안을 만듭니다. 영역과
학생의 현재 수준을 보고, 관찰·측정 가능한 행동으로 서술된 목표 문장을
2~3개 제안하세요. "~을 ~수준으로 수행한다"와 같은 형태로 씁니다. 문장에
[[P1]], [[P2]] 같은 대괄호 토큰이 보이면 절대 지우거나 바꾸지 말고 그 형태
그대로 남겨 두세요.

영역: ${input.areaLabel}
현재 수준: ${input.currentLevel}

다음 JSON 형식으로만 답하세요:
{"goals": ["목표 문장 후보1", "목표 문장 후보2"]}`

  const text = await callGemini(apiKey, [{ text: prompt }])
  const record = parseJsonRecord(text)
  const goals = Array.isArray(record.goals)
    ? record.goals.filter((g): g is string => typeof g === 'string' && g.trim().length > 0)
    : []
  if (goals.length === 0) throw new Error('목표 문장을 만들지 못했습니다')
  return goals.slice(0, 3)
}

export interface PbsTrendSummaryInput {
  weeksCovered: number
  totalCount: number
  byWeekday: Array<{ label: string; count: number }>
  byCategory: Array<{ label: string; count: number }>
  byLocation: Array<{ label: string; count: number }>
}

/**
 * PBS 8주 추세 요약 — 이미 집계된 건수(요일·분류·장소별)만 받는다. 학생
 * 이름·원문 기록은 이 함수에 절대 넘기지 않는다(호출부 책임).
 */
export async function summarizePbsTrend(apiKey: string, input: PbsTrendSummaryInput): Promise<string> {
  const prompt = `다음은 특수학교의 최근 ${input.weeksCovered}주간 행동지원(PBS) 기록
건수를 요일·분류·장소별로 집계한 수치입니다. 개별 학생을 언급하지 말고,
전체 경향과 눈에 띄는 패턴(예: 특정 요일·장소에 집중되는 경향)을 교사가
참고할 수 있도록 3~4문장으로 요약하세요.

전체 건수: ${input.totalCount}건
요일별: ${input.byWeekday.map((w) => `${w.label} ${w.count}건`).join(', ')}
분류별: ${input.byCategory.map((c) => `${c.label} ${c.count}건`).join(', ')}
장소별: ${input.byLocation.map((l) => `${l.label} ${l.count}건`).join(', ')}

다음 JSON 형식으로만 답하세요:
{"summary": "전체 경향 요약, 3~4문장"}`

  const text = await callGemini(apiKey, [{ text: prompt }])
  const record = parseJsonRecord(text)
  const summary = typeof record.summary === 'string' ? record.summary : ''
  if (!summary) throw new Error('Gemini 응답을 읽을 수 없습니다')
  return summary
}

export interface SocialStoryInput {
  title: string
  /** 이미 마스킹된 상황 설명 — [[P1]] 같은 토큰이 그대로 남아 있어야 한다 */
  situation: string
  level: EasyReadLevel
}

export interface SocialStoryResult {
  text: string
  keywords: string[]
}

/**
 * 사회적 이야기(Social Story) 생성. 상황 설명 → 다른 사람의 감정 →
 * 대처 행동 순서로 짧게 쓰도록 지시한다. easy-read의 3단계 쉬운글
 * 수준 개념을 그대로 쓴다.
 */
export async function generateSocialStory(apiKey: string, input: SocialStoryInput): Promise<SocialStoryResult> {
  const prompt = `발달장애 학생을 위한 사회적 이야기(Social Story)를 씁니다.
${LEVEL_INSTRUCTION[input.level]}
다음 순서로 4~8문장을 씁니다: ① 상황을 있는 그대로 설명하는 문장
② 그 상황에서 다른 사람들이 느끼거나 생각하는 것을 설명하는 문장
③ 학생이 할 수 있는 대처 행동을 안내하는 문장. 문장에 [[P1]], [[P2]]
같은 대괄호 토큰이 보이면 절대 지우거나 바꾸지 말고 그 형태 그대로
남겨 두세요.

제목: ${input.title}
상황: ${input.situation}

다음 JSON 형식으로만 답하세요:
{"text": "이야기 전체", "keywords": ["핵심 낱말 3~6개(그림으로 나타낼 수 있는 명사 위주, 한 단어씩)"]}`

  const text = await callGemini(apiKey, [{ text: prompt }])
  const record = parseJsonRecord(text)

  const resultText = typeof record.text === 'string' ? record.text : ''
  if (!resultText) throw new Error('Gemini 응답을 읽을 수 없습니다')

  const keywords = Array.isArray(record.keywords)
    ? record.keywords.filter((k): k is string => typeof k === 'string').slice(0, 6)
    : []

  return { text: resultText, keywords }
}

export interface VisualScheduleItem {
  label: string
  keyword: string
}

/**
 * 시각적 일과표 생성. 활동마다 학생이 이해하기 쉬운 짧은 표현(label)과
 * 그림 검색에 쓸 낱말(keyword) 하나씩을 만든다. items는 이미 마스킹된
 * 상태로 들어온다 — 순서를 그대로 유지해서 반환해야 한다.
 */
export async function generateVisualSchedule(
  apiKey: string,
  input: { title: string; items: string[] },
): Promise<VisualScheduleItem[]> {
  const prompt = `발달장애 학생을 위한 시각적 일과표를 만듭니다. 아래
활동 목록 순서를 그대로 유지하면서, 각 활동을 학생이 이해하기 쉬운
아주 짧은 표현(2~4어절)과 그림으로 찾을 낱말 하나로 바꿔 주세요.
문장에 [[P1]], [[P2]] 같은 대괄호 토큰이 보이면 절대 지우거나 바꾸지
말고 그 형태 그대로 남겨 두세요.

일과 제목: ${input.title}
활동 목록(순서대로):
${input.items.map((item, i) => `${i + 1}. ${item}`).join('\n')}

다음 JSON 형식으로만 답하세요(activities 배열 길이와 순서는 입력과
반드시 같아야 합니다):
{"activities": [{"label": "짧은 표현", "keyword": "그림 검색 낱말"}, ...]}`

  const text = await callGemini(apiKey, [{ text: prompt }])
  const record = parseJsonRecord(text)
  const activities = Array.isArray(record.activities) ? record.activities : []

  const result: VisualScheduleItem[] = activities
    .filter((a): a is Record<string, unknown> => typeof a === 'object' && a !== null)
    .map((a) => ({
      label: typeof a.label === 'string' ? a.label : '',
      keyword: typeof a.keyword === 'string' ? a.keyword : '',
    }))
    .filter((a) => a.label && a.keyword)

  if (result.length === 0) throw new Error('일과표를 만들지 못했습니다')
  return result
}

/** 전공과 작업분석 — 작업을 5~12개의 짧고 구체적인 수행 단계로 나눈다. */
export async function generateTaskAnalysis(
  apiKey: string,
  input: { taskName: string; currentLevel: string },
): Promise<string[]> {
  const prompt = `특수학교 전공과(직업교육) 작업분석을 만듭니다. 아래
작업을 학생이 순서대로 따라 할 수 있도록 5~12개의 짧고 구체적인 단계로
나눠 주세요. 한 단계는 동작 하나만 담습니다(예: "수도꼭지를 돌려
물을 튼다"). 문장에 [[P1]], [[P2]] 같은 대괄호 토큰이 보이면 절대
지우거나 바꾸지 말고 그 형태 그대로 남겨 두세요.

작업: ${input.taskName}
${input.currentLevel ? `현재 수행 수준: ${input.currentLevel}` : ''}

다음 JSON 형식으로만 답하세요:
{"steps": ["1단계", "2단계", "..."]}`

  const text = await callGemini(apiKey, [{ text: prompt }])
  const record = parseJsonRecord(text)
  const steps = Array.isArray(record.steps)
    ? record.steps.filter((s): s is string => typeof s === 'string' && s.trim().length > 0)
    : []
  if (steps.length === 0) throw new Error('작업분석을 만들지 못했습니다')
  return steps.slice(0, 12)
}

export interface MaterialLevelsResult {
  high: string
  mid: string
  low: string
}

/** 수업자료 3단계 난이도 변환 — easy-read와 같은 3단계 철학을 임의의 수업 자료 본문에 적용한다. */
export async function generateMaterialLevels(
  apiKey: string,
  input: { text: string; subject: string | null },
): Promise<MaterialLevelsResult> {
  const prompt = `다음 수업 자료를 세 가지 난이도로 다시 씁니다. 문장에
[[P1]], [[P2]] 같은 대괄호 토큰이 보이면 절대 지우거나 바꾸지 말고 그
형태 그대로 남겨 두세요.

- 상: 원문과 비슷한 수준으로, 문장만 자연스럽게 다듬습니다
- 중: 쉬운 낱말 위주로 다시 씁니다. 어려운 한자어는 풀어 씁니다
- 하: 문장을 아주 짧게(3~5어절) 쓰고 가장 쉬운 낱말만 씁니다

${input.subject ? `교과: ${input.subject}` : ''}
원본 자료: ${input.text}

다음 JSON 형식으로만 답하세요:
{"high": "상 수준 전체", "mid": "중 수준 전체", "low": "하 수준 전체"}`

  const text = await callGemini(apiKey, [{ text: prompt }])
  const record = parseJsonRecord(text)

  const high = typeof record.high === 'string' ? record.high : ''
  const mid = typeof record.mid === 'string' ? record.mid : ''
  const low = typeof record.low === 'string' ? record.low : ''
  if (!high || !mid || !low) throw new Error('Gemini 응답을 읽을 수 없습니다')

  return { high, mid, low }
}

/** 감각특성 고려 활동 대안 — 지정된 감각 민감도를 고려한 대안 활동 2~4개를 제안한다. */
export async function generateSensoryAlternatives(
  apiKey: string,
  input: { activity: string; sensitivities: string[]; note: string },
): Promise<string[]> {
  const prompt = `특수학교 수업 활동의 감각특성 고려 대안을 제안합니다.
아래 활동을, 학생이 가진 감각 민감도를 고려해 대신할 수 있는 대안
활동을 2~4개 제안해 주세요. 각 대안은 원래 활동과 같은 학습 목표를
최대한 유지하면서 감각 자극만 조정합니다. 문장에 [[P1]], [[P2]] 같은
대괄호 토큰이 보이면 절대 지우거나 바꾸지 말고 그 형태 그대로 남겨
두세요.

원래 활동: ${input.activity}
고려할 감각특성: ${input.sensitivities.join(', ')}
${input.note ? `추가 설명: ${input.note}` : ''}

다음 JSON 형식으로만 답하세요:
{"alternatives": ["대안1", "대안2"]}`

  const text = await callGemini(apiKey, [{ text: prompt }])
  const record = parseJsonRecord(text)
  const alternatives = Array.isArray(record.alternatives)
    ? record.alternatives.filter((a): a is string => typeof a === 'string' && a.trim().length > 0)
    : []
  if (alternatives.length === 0) throw new Error('대안을 만들지 못했습니다')
  return alternatives.slice(0, 4)
}
