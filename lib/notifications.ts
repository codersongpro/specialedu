import 'server-only'

import { createAdminClient } from '@/lib/supabase/admin'

/**
 * 앱 안 알림을 만든다.
 *
 * 감사로그와 같은 이유로 service role 을 쓴다 — 알림을 사용자가
 * 직접 만들 수 있으면 스팸처럼 남용될 수 있다. 실패해도 원래 하려던
 * 작업(배정·승인 등)을 막으면 안 되므로 예외를 던지지 않는다.
 */
export async function notify(params: {
  schoolId: string
  profileId: string | null
  title: string
  body?: string
  link?: string
}): Promise<void> {
  if (!params.profileId) return
  try {
    const admin = createAdminClient()
    await admin.from('notifications').insert({
      school_id: params.schoolId,
      profile_id: params.profileId,
      title: params.title,
      body: params.body ?? null,
      link: params.link ?? null,
    })
  } catch (error) {
    console.error('[notify] 실패', error)
  }
}
