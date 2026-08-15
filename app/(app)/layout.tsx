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
  if (!session) redirect('/login')

  const { profile, school } = session
  const nav = visibleNav(isAdmin(profile))

  return (
    <AppShell
      nav={nav}
      schoolId={school.id}
      schoolName={school.name}
      isDemo={school.is_demo}
      profileName={profile.name}
      roleLabel={ROLE_LABEL[profile.role] ?? ''}
    >
      {children}
    </AppShell>
  )
}
