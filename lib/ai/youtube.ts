import 'server-only'

/**
 * 유튜브 수업 자료 검색.
 *
 * 학생 이름 등 개인정보를 전혀 받지 않는 화면이라(과정·수준·제재만
 * 입력) 마스킹이 필요 없다. 안전장치는 YouTube 쪽 필터에 맡긴다:
 * safeSearch=strict, videoEmbeddable(임베드 가능한 것만), 한국어 우선.
 */

export interface VideoResult {
  videoId: string
  title: string
  channelTitle: string
  thumbnailUrl: string
  durationSec: number | null
}

const API_BASE = 'https://www.googleapis.com/youtube/v3'

export async function searchVideos(apiKey: string, queries: string[]): Promise<VideoResult[]> {
  const seen = new Map<string, VideoResult>()

  for (const query of queries) {
    const params = new URLSearchParams({
      key: apiKey,
      part: 'snippet',
      type: 'video',
      q: query,
      maxResults: '5',
      safeSearch: 'strict',
      videoEmbeddable: 'true',
      relevanceLanguage: 'ko',
    })

    const res = await fetch(`${API_BASE}/search?${params}`)
    if (!res.ok) continue

    const data = (await res.json()) as {
      items?: Array<{
        id?: { videoId?: string }
        snippet?: {
          title?: string
          channelTitle?: string
          thumbnails?: { medium?: { url?: string }; default?: { url?: string } }
        }
      }>
    }

    for (const item of data.items ?? []) {
      const videoId = item.id?.videoId
      if (!videoId || seen.has(videoId)) continue
      seen.set(videoId, {
        videoId,
        title: item.snippet?.title ?? '',
        channelTitle: item.snippet?.channelTitle ?? '',
        thumbnailUrl: item.snippet?.thumbnails?.medium?.url ?? item.snippet?.thumbnails?.default?.url ?? '',
        durationSec: null,
      })
    }
  }

  const results = Array.from(seen.values()).slice(0, 15)
  if (results.length === 0) return results

  // 길이 필터링을 하려면 videos.list 로 재생시간을 따로 받아와야 한다
  const ids = results.map((r) => r.videoId).join(',')
  const durationRes = await fetch(
    `${API_BASE}/videos?key=${encodeURIComponent(apiKey)}&part=contentDetails&id=${ids}`,
  )
  if (durationRes.ok) {
    const durationData = (await durationRes.json()) as {
      items?: Array<{ id: string; contentDetails?: { duration?: string } }>
    }
    const durationById = new Map(
      (durationData.items ?? []).map((item) => [item.id, parseIsoDuration(item.contentDetails?.duration ?? '')]),
    )
    for (const result of results) {
      result.durationSec = durationById.get(result.videoId) ?? null
    }
  }

  return results
}

/** "PT4M13S" 같은 ISO 8601 재생시간을 초로 바꾼다 */
function parseIsoDuration(iso: string): number | null {
  const match = /^PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?$/.exec(iso)
  if (!match) return null
  const [, h, m, s] = match
  return Number(h ?? 0) * 3600 + Number(m ?? 0) * 60 + Number(s ?? 0)
}
