'use server'

import { createHash } from 'node:crypto'
import { z } from 'zod'
import { generateSearchTerms, type EasyReadLevel } from '@/lib/ai/gemini'
import { searchVideos, type VideoResult } from '@/lib/ai/youtube'
import { AUDIT_ACTIONS, writeAudit } from '@/lib/security/audit'
import { decryptSecret } from '@/lib/security/crypto'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireSession } from '@/lib/supabase/server'

const COURSE_LABEL: Record<string, string> = {
  elementary: '초등',
  middle: '중학',
  high: '고등',
  vocational: '전공과',
}

const SearchInput = z.object({
  course: z.enum(['elementary', 'middle', 'high', 'vocational']),
  level: z.union([z.literal(1), z.literal(2), z.literal(3)]),
  topic: z.string().min(1, '제재·주제를 적어 주세요').max(100),
  subject: z.string().max(40).optional(),
  lengthBucket: z.enum(['any', 'short', 'medium', 'long']),
})
type SearchInputType = z.input<typeof SearchInput>

export interface MediaSearchResult {
  videos?: VideoResult[]
  cached?: boolean
  error?: string
}

const CACHE_TOOL = 'media_search'

export async function searchMedia(input: SearchInputType): Promise<MediaSearchResult> {
  const session = await requireSession()

  const parsed = SearchInput.safeParse(input)
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? '입력을 확인하세요' }
  const data = parsed.data

  const admin = createAdminClient()
  const cacheKey = createHash('sha256').update(JSON.stringify(data)).digest('hex')

  const { data: cached } = await admin
    .from('ai_cache')
    .select('result')
    .eq('school_id', session.school.id)
    .eq('tool', CACHE_TOOL)
    .eq('input_hash', cacheKey)
    .gt('expires_at', new Date().toISOString())
    .maybeSingle()

  if (cached) {
    return { videos: cached.result as VideoResult[], cached: true }
  }

  const youtubeKey = process.env.YOUTUBE_API_KEY
  if (!youtubeKey) {
    return { error: '유튜브 검색 키가 설정되지 않았습니다. 관리자에게 문의하세요.' }
  }

  const keySource: 'personal' | 'school' | null = session.profile.gemini_key_enc
    ? 'personal'
    : session.school.gemini_key_enc
      ? 'school'
      : null
  const encryptedKey = session.profile.gemini_key_enc ?? session.school.gemini_key_enc
  if (!encryptedKey || !keySource) {
    return { error: '등록된 Gemini 키가 없습니다. 내 설정 또는 학교 관리에서 키를 등록해 주세요.' }
  }

  try {
    const apiKey = decryptSecret(encryptedKey)
    const level: EasyReadLevel = data.level
    const queries = await generateSearchTerms(apiKey, {
      course: COURSE_LABEL[data.course] ?? data.course,
      level,
      topic: data.topic,
      subject: data.subject || null,
    })

    const videos = filterByLength(await searchVideos(youtubeKey, queries), data.lengthBucket)

    await admin.from('ai_cache').upsert(
      {
        school_id: session.school.id,
        tool: CACHE_TOOL,
        input_hash: cacheKey,
        result: videos,
        expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
      },
      { onConflict: 'school_id,tool,input_hash' },
    )
    await admin.from('ai_usage_logs').insert({
      school_id: session.school.id,
      profile_id: session.userId,
      tool: CACHE_TOOL,
      key_source: keySource,
      ok: true,
    })
    await writeAudit({
      schoolId: session.school.id,
      actorId: session.userId,
      actorName: session.profile.name,
      action: AUDIT_ACTIONS.aiRequest,
      meta: { tool: CACHE_TOOL },
    })

    return { videos }
  } catch {
    await admin.from('ai_usage_logs').insert({
      school_id: session.school.id,
      profile_id: session.userId,
      tool: CACHE_TOOL,
      key_source: keySource,
      ok: false,
      error_code: 'search_failed',
    })
    return { error: '검색하지 못했습니다. 잠시 후 다시 시도해 주세요.' }
  }
}

function filterByLength(videos: VideoResult[], bucket: 'any' | 'short' | 'medium' | 'long'): VideoResult[] {
  if (bucket === 'any') return videos
  return videos.filter((v) => {
    if (v.durationSec == null) return true
    if (bucket === 'short') return v.durationSec < 240
    if (bucket === 'medium') return v.durationSec >= 240 && v.durationSec <= 1200
    return v.durationSec > 1200
  })
}
