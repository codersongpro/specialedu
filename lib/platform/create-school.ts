import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/lib/supabase/database.types'
import { createInviteToken, inviteExpiryFrom } from '@/lib/security/invite'

/**
 * 학교 개설 + 첫 관리자 초대.
 *
 * CLI(scripts/new-school.ts)와 /platform 화면(app/platform/actions.ts)이
 * 이 함수 하나를 같이 쓴다. 로직이 두 곳에 따로 있으면 한쪽만 고치고
 * 잊어버리는 사고가 난다.
 */

type AdminClient = SupabaseClient<Database>

const DEFAULT_DEPARTMENTS = ['교무부', '연구부', '생활지도부', '진로직업부', '방과후부']

export class SchoolAlreadyExistsError extends Error {}

export interface NewSchoolInput {
  name: string
  adminEmail: string
  adminName: string
  neisCode?: string | null
}

export interface NewSchoolResult {
  schoolId: string
  inviteToken: string
}

export async function createSchoolWithFirstAdmin(
  db: AdminClient,
  input: NewSchoolInput,
): Promise<NewSchoolResult> {
  // 같은 이름의 학교가 이미 있으면 멈춘다. 실수로 두 번 만들면
  // 교직원이 어느 쪽에 초대됐는지 알 수 없게 된다.
  const { data: existing } = await db
    .from('schools')
    .select('id')
    .eq('name', input.name)
    .maybeSingle()

  if (existing) {
    throw new SchoolAlreadyExistsError(`이미 등록된 학교입니다: ${input.name}`)
  }

  const { data: school, error: schoolError } = await db
    .from('schools')
    .insert({
      name: input.name,
      neis_code: input.neisCode ?? null,
      timezone: 'Asia/Seoul',
      is_demo: false,
    })
    .select('id')
    .single()

  if (schoolError || !school) throw schoolError ?? new Error('학교를 만들지 못했습니다')

  await db
    .from('departments')
    .insert(DEFAULT_DEPARTMENTS.map((name) => ({ school_id: school.id, name })))

  // 결보강 가중치는 기본값으로 시작한다. 학교 관리자가 화면에서 조정한다.
  await db.from('substitution_rules').insert({ school_id: school.id })

  // 첫 관리자 초대. 평문 토큰은 여기서 한 번만 만들어지고 DB 에는 해시만 남는다.
  const { token, hash } = createInviteToken()

  const { error: inviteError } = await db.from('invitations').insert({
    school_id: school.id,
    email: input.adminEmail.toLowerCase(),
    name: input.adminName,
    role: 'admin',
    employment: 'full_time',
    token_hash: hash,
    expires_at: inviteExpiryFrom().toISOString(),
  })

  if (inviteError) throw inviteError

  return { schoolId: school.id, inviteToken: token }
}
