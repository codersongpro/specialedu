import { AppBrand } from '@/components/brand'
import { hashInviteToken } from '@/lib/security/invite'
import { createAdminClient } from '@/lib/supabase/admin'
import { InviteForm } from './invite-form'

export const metadata = { title: '계정 만들기' }

const ROLE_LABEL: Record<string, string> = {
  admin: '학교관리자',
  manager: '부장',
  teacher: '교사',
  part_time: '시간강사',
  staff: '실무사',
}

export default async function InvitePage({
  params,
}: {
  params: Promise<{ token: string }>
}) {
  const { token } = await params

  const admin = createAdminClient()
  const { data: invitation } = await admin
    .from('invitations')
    .select('name, email, role, school_id, expires_at, accepted_at')
    .eq('token_hash', hashInviteToken(token))
    .maybeSingle()

  const expired = invitation ? new Date(invitation.expires_at) < new Date() : false
  const used = Boolean(invitation?.accepted_at)

  if (!invitation || expired || used) {
    return (
      <main className="flex min-h-dvh items-center justify-center px-6">
        <div className="w-full max-w-sm">
          <AppBrand size="sm" className="mb-6" />
          <h1 className="text-xl font-semibold">
            {used ? '이미 사용한 링크입니다' : '쓸 수 없는 링크입니다'}
          </h1>
          <p className="mt-2 text-sm text-ink-soft">
            {used
              ? '계정이 이미 만들어져 있습니다. 로그인 화면에서 로그인하세요.'
              : '링크가 만료됐거나 잘못됐습니다. 교무실에 다시 요청하세요.'}
          </p>
          <a href="/login" className="mt-6 inline-block text-sm font-medium text-brand">
            로그인 화면으로
          </a>
        </div>
      </main>
    )
  }

  const { data: school } = await admin
    .from('schools')
    .select('name')
    .eq('id', invitation.school_id)
    .maybeSingle()

  return (
    <main className="flex min-h-dvh items-center justify-center px-6 py-12">
      <div className="w-full max-w-sm">
        <AppBrand size="sm" className="mb-6" />
        <h1 className="text-xl font-semibold">비밀번호를 정해 주세요</h1>
        <p className="mt-2 text-sm text-ink-soft">
          {school?.name ?? '학교'} · {invitation.name} {ROLE_LABEL[invitation.role] ?? ''}
        </p>
        <p className="mt-1 text-sm text-ink-soft">{invitation.email}</p>

        <InviteForm token={token} />
      </div>
    </main>
  )
}
