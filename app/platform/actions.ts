'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { createSchoolWithFirstAdmin, SchoolAlreadyExistsError } from '@/lib/platform/create-school'
import { createInviteToken, inviteExpiryFrom } from '@/lib/security/invite'
import { AUDIT_ACTIONS, writeAudit } from '@/lib/security/audit'
import { requirePlatformAdmin } from '@/lib/security/platform'
import { createAdminClient } from '@/lib/supabase/admin'

const NewSchoolInput = z.object({
  name: z.string().min(1, '학교 이름을 적어 주세요').max(80),
  adminEmail: z.string().email('이메일 형식이 아닙니다'),
  adminName: z.string().min(1, '이름을 적어 주세요').max(40),
  neisCode: z.string().max(20).optional(),
})

export interface NewSchoolState {
  error?: string
  link?: string
  schoolName?: string
}

export async function createSchool(
  _prev: NewSchoolState,
  formData: FormData,
): Promise<NewSchoolState> {
  const platformAdmin = await requirePlatformAdmin()

  const parsed = NewSchoolInput.safeParse({
    name: formData.get('name'),
    adminEmail: formData.get('adminEmail'),
    adminName: formData.get('adminName'),
    neisCode: formData.get('neisCode') || undefined,
  })
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? '입력을 확인하세요' }
  }

  const admin = createAdminClient()

  try {
    const result = await createSchoolWithFirstAdmin(admin, {
      name: parsed.data.name,
      adminEmail: parsed.data.adminEmail,
      adminName: parsed.data.adminName,
      neisCode: parsed.data.neisCode ?? null,
    })

    await writeAudit({
      schoolId: result.schoolId,
      actorId: platformAdmin.id,
      actorName: platformAdmin.email,
      action: AUDIT_ACTIONS.platformSchoolCreate,
      targetTable: 'schools',
      targetId: result.schoolId,
    })

    revalidatePath('/platform')
    return { link: `/invite/${result.inviteToken}`, schoolName: parsed.data.name }
  } catch (error) {
    if (error instanceof SchoolAlreadyExistsError) return { error: error.message }
    console.error('[platform] 학교 생성 실패', error)
    return { error: '학교를 만들지 못했습니다' }
  }
}

const InviteAdminInput = z.object({
  schoolId: z.string().uuid(),
  email: z.string().email('이메일 형식이 아닙니다'),
  name: z.string().min(1, '이름을 적어 주세요').max(40),
})

export interface InviteAdminState {
  error?: string
  link?: string
  schoolId?: string
}

/**
 * 이미 있는 학교에 관리자를 추가·재지정한다.
 *
 * 학교 개설 때 첫 관리자를 정하는 것과 같은 매커니즘(초대 토큰)을 쓴다.
 * 최고관리자는 그 학교 profiles 가 없어 직접 role 을 바꿔줄 수 없고,
 * 초대를 거쳐야 정식으로 프로필이 만들어진다.
 */
export async function inviteSchoolAdmin(
  _prev: InviteAdminState,
  formData: FormData,
): Promise<InviteAdminState> {
  const platformAdmin = await requirePlatformAdmin()

  const parsed = InviteAdminInput.safeParse({
    schoolId: formData.get('schoolId'),
    email: formData.get('email'),
    name: formData.get('name'),
  })
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? '입력을 확인하세요' }
  }

  const admin = createAdminClient()

  const { data: school } = await admin
    .from('schools')
    .select('id, name')
    .eq('id', parsed.data.schoolId)
    .maybeSingle()

  if (!school) return { error: '학교를 찾을 수 없습니다' }

  const { token, hash } = createInviteToken()
  const { error } = await admin.from('invitations').insert({
    school_id: school.id,
    email: parsed.data.email.toLowerCase(),
    name: parsed.data.name,
    role: 'admin',
    employment: 'full_time',
    token_hash: hash,
    expires_at: inviteExpiryFrom().toISOString(),
  })

  if (error) return { error: '초대를 만들지 못했습니다. 이미 초대한 이메일인지 확인하세요.' }

  await writeAudit({
    schoolId: school.id,
    actorId: platformAdmin.id,
    actorName: platformAdmin.email,
    action: AUDIT_ACTIONS.platformAdminInvite,
    targetTable: 'invitations',
    meta: { email: parsed.data.email },
  })

  revalidatePath('/platform')
  return { link: `/invite/${token}`, schoolId: school.id }
}
