import { redirect } from 'next/navigation'
import { AppShell } from '@/components/app-shell'
import { getSessionContext, isAdmin } from '@/lib/supabase/server'
import { visibleNav } from '@/lib/security/sensitivity'

const ROLE_LABEL: Record<string, string> = {
  admin: '학교관리자',
  manager: '부장',
  teacher: '교사',
  part_time: '시간강사',
  staff: '실무사',
}

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await getSessionContext()
  // /login 이 아니라 /logout 으로 보낸다. 여기까지 왔다는 건 미들웨어는
  // 로그인된 것으로 봤는데(auth 계정이 살아 있다) 프로필·학교를 못 찾았다는
  // 뜻이다. 그대로 /login 으로 보내면 미들웨어가 다시 /dashboard 로 돌려보내
  // 무한 리다이렉트에 갇힌다. /logout 라우트가 세션을 실제로 끊어 준다.
  if (!session) redirect('/logout')

  const { profile, school } = session
  const nav = visibleNav(isAdmin(profile))

  return (
    <AppShell
      nav={nav}
      schoolId={school.id}
      schoolName={school.name}
      isDemo={school.is_demo}
      profileId={session.userId}
      profileName={profile.name}
      roleLabel={ROLE_LABEL[profile.role] ?? ''}
    >
      {children}
    </AppShell>
  )
}
