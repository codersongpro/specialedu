import 'server-only'

/**
 * ARASAAC 공개 그림 상징 검색.
 *
 * 이미지를 생성하지 않고 고정 심볼을 쓰는 이유: ① 같은 낱말에 늘 같은
 * 그림이 나와야 학생이 익힐 수 있고 ② 생성 이미지는 부정확하거나
 * 저작권이 불분명하고 ③ 외부 호출이 줄어 무료 한도를 아낄 수 있다.
 * (CC BY-NC-SA — 교육 목적 비영리 사용)
 *
 * 매칭 실패는 흔하다(낱말이 사전에 없거나 API가 느릴 때). 실패해도
 * 화면은 그림 없이 텍스트만 보여주면 되므로, 여기서는 예외를 던지지
 * 않고 항상 null 을 채워 돌려준다.
 */

export interface PictogramMatch {
  keyword: string
  /** ARASAAC pictogram id. 없으면 매칭 실패. */
  id: number | null
}

const SEARCH_TIMEOUT_MS = 4000

export async function matchPictograms(keywords: string[]): Promise<PictogramMatch[]> {
  return Promise.all(keywords.map(matchOne))
}

async function matchOne(keyword: string): Promise<PictogramMatch> {
  try {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), SEARCH_TIMEOUT_MS)
    const res = await fetch(
      `https://api.arasaac.org/api/pictograms/ko/search/${encodeURIComponent(keyword)}`,
      { signal: controller.signal },
    )
    clearTimeout(timer)
    if (!res.ok) return { keyword, id: null }

    const data = (await res.json()) as unknown
    const first = Array.isArray(data) ? data[0] : null
    const id =
      first && typeof first === 'object' && '_id' in first && typeof first._id === 'number'
        ? first._id
        : null
    return { keyword, id }
  } catch {
    return { keyword, id: null }
  }
}

export function pictogramImageUrl(id: number): string {
  return `https://static.arasaac.org/pictograms/${id}/${id}_500.png`
}
