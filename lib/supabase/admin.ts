import 'server-only'

import { createClient as createSupabaseClient } from '@supabase/supabase-js'
import type { Database } from './database.types'

/**
 * RLS 를 우회하는 관리자 클라이언트.
 *
 * 'server-only' 를 import 해서 이 파일이 클라이언트 번들에 섞이면
 * 빌드가 실패하게 해 두었다. 실수로 새어 나가면 학교 전체 데이터가 노출된다.
 *
 * 쓰는 곳은 세 군데뿐이다:
 *   - 초대 수락 (아직 프로필이 없어 RLS 를 통과할 수 없다)
 *   - 감사로그 기록 (교직원이 자기 기록을 지울 수 없어야 한다)
 *   - 데모 시드 · 정리 배치
 */
export function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!url || !serviceKey) {
    throw new Error('SUPABASE_SERVICE_ROLE_KEY 가 설정되지 않았습니다')
  }

  return createSupabaseClient<Database>(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
}
