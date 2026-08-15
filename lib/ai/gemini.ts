import 'server-only'

/**
 * Gemini Vision 호출 — 영수증 사진에서 금액·날짜·상호명을 읽는다.
 *
 * 이 앱에서 Gemini를 실제로 호출하는 첫 코드다. 서버에서만 부르고,
 * API 키는 호출부(actions.ts)에서 복호화해 인자로 넘긴다 — 이 파일은
 * 키를 저장하거나 로그로 남기지 않는다.
 */

const MODEL = process.env.GEMINI_MODEL || 'gemini-2.5-flash'

export interface ReceiptExtraction {
  amount: number | null
  date: string | null // YYYY-MM-DD
  vendor: string | null
}

export async function extractReceiptFields(
  apiKey: string,
  imageBase64: string,
  mimeType: string,
): Promise<ReceiptExtraction> {
  const prompt =
    '이 이미지는 한국의 영수증 또는 지출 증빙입니다. 다음 JSON 형식으로만 답하세요. ' +
    '확실하지 않은 값은 null로 두세요.\n' +
    '{"amount": 합계금액(숫자만, 콤마·원 표시 제외), "date": "YYYY-MM-DD", "vendor": "상호명"}'

  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${encodeURIComponent(apiKey)}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [
          {
            parts: [{ text: prompt }, { inline_data: { mime_type: mimeType, data: imageBase64 } }],
          },
        ],
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

  let parsed: unknown
  try {
    parsed = JSON.parse(text)
  } catch {
    throw new Error('Gemini 응답 형식이 올바르지 않습니다')
  }

  if (typeof parsed !== 'object' || parsed === null) {
    throw new Error('Gemini 응답 형식이 올바르지 않습니다')
  }
  const record = parsed as Record<string, unknown>

  return {
    amount: typeof record.amount === 'number' && Number.isFinite(record.amount) ? Math.round(record.amount) : null,
    date:
      typeof record.date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(record.date) ? record.date : null,
    vendor: typeof record.vendor === 'string' ? record.vendor.slice(0, 100) : null,
  }
}
