'use server'

import { AUDIT_ACTIONS, writeAudit } from '@/lib/security/audit'
import { createAdminClient } from '@/lib/supabase/admin'
import { getSessionContext } from '@/lib/supabase/server'

/**
 * 민감 구역 진입 확인 기록.
 *
 * "경고를 읽었다"는 사실 자체를 남긴다. 나중에 문제가 생겼을 때
 * 안내를 했는지 여부가 쟁점이 되기 때문이다.
 */
export async function acknowledgeZone(zone: string): Promise<void> {
  const session = await getSessionContext()
  if (!session) return

  const admin = createAdminClient()
  await admin.from('sensitivity_acks').insert({
    school_id: session.school.id,
    profile_id: session.userId,
    zone,
  })

  await writeAudit({
    schoolId: session.school.id,
    actorId: session.userId,
    actorName: session.profile.name,
    action: AUDIT_ACTIONS.sensitiveZoneEnter,
    meta: { zone },
  })
}
