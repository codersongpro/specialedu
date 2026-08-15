import { Badge, Card, EmptyState, PageHeader } from '@/components/ui'
import { createAdminClient } from '@/lib/supabase/admin'
import { NewSchoolForm } from './new-school-form'
import { SchoolAdminForm } from './school-admin-form'

export default async function PlatformPage() {
  // 최고관리자는 profiles 가 없어 RLS 를 통과 못 한다. 관리자 클라이언트로 읽는다.
  const admin = createAdminClient()

  const { data: schools } = await admin
    .from('schools')
    .select('id, name, is_demo, neis_code')
    .order('name')

  const { data: profiles } = await admin.from('profiles').select('id, school_id, role')

  const { data: pendingInvites } = await admin
    .from('invitations')
    .select('school_id, email, name, role, expires_at')
    .is('accepted_at', null)
    .order('created_at', { ascending: false })

  const staffCountBySchool = new Map<string, number>()
  const adminExistsBySchool = new Set<string>()
  for (const profile of profiles ?? []) {
    staffCountBySchool.set(profile.school_id, (staffCountBySchool.get(profile.school_id) ?? 0) + 1)
    if (profile.role === 'admin' || profile.role === 'manager') {
      adminExistsBySchool.add(profile.school_id)
    }
  }

  const invitesBySchool = new Map<string, typeof pendingInvites>()
  for (const invite of pendingInvites ?? []) {
    const list = invitesBySchool.get(invite.school_id) ?? []
    list.push(invite)
    invitesBySchool.set(invite.school_id, list)
  }

  const realSchools = (schools ?? []).filter((s) => !s.is_demo)
  const demoSchools = (schools ?? []).filter((s) => s.is_demo)

  return (
    <>
      <PageHeader
        title="학교 관리"
        description="이 서버 하나에 여러 특수학교가 함께 들어갑니다. 학교끼리는 완전히 격리됩니다."
      />

      <div className="space-y-6">
        <Card className="p-5">
          <h2 className="text-sm font-semibold">새 학교 열기</h2>
          <p className="mt-1 text-sm text-ink-soft">
            학교를 만들면 부서 기본값과 결보강 규칙 기본값이 함께 생기고,
            첫 관리자에게 줄 초대 링크가 나옵니다.
          </p>
          <div className="mt-4 max-w-md">
            <NewSchoolForm />
          </div>
        </Card>

        <Card>
          <h2 className="border-b border-line px-4 py-3 text-sm font-semibold">
            등록된 학교 {realSchools.length}
          </h2>
          {realSchools.length === 0 ? (
            <EmptyState title="아직 등록된 학교가 없습니다" />
          ) : (
            <ul className="divide-y divide-line">
              {realSchools.map((school) => (
                <li key={school.id} className="p-4">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-medium">{school.name}</span>
                    <span className="text-xs text-ink-soft">
                      교직원 {staffCountBySchool.get(school.id) ?? 0}명
                    </span>
                    {!adminExistsBySchool.has(school.id) ? (
                      <Badge tone="warn">관리자 없음</Badge>
                    ) : null}
                  </div>

                  {(invitesBySchool.get(school.id) ?? []).length > 0 ? (
                    <ul className="mt-2 space-y-1">
                      {(invitesBySchool.get(school.id) ?? []).map((invite) => (
                        <li key={invite!.email} className="text-xs text-ink-soft">
                          대기 중: {invite!.name} ({invite!.email}) ·{' '}
                          {invite!.expires_at.slice(0, 10)}까지
                        </li>
                      ))}
                    </ul>
                  ) : null}

                  <div className="mt-3 max-w-md">
                    <SchoolAdminForm schoolId={school.id} />
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Card>

        {demoSchools.length > 0 ? (
          <Card>
            <h2 className="border-b border-line px-4 py-3 text-sm font-semibold">
              데모 학교 {demoSchools.length}
            </h2>
            <ul className="divide-y divide-line">
              {demoSchools.map((school) => (
                <li key={school.id} className="flex items-center gap-2 px-4 py-2.5 text-sm">
                  <span>{school.name}</span>
                  <Badge>데모</Badge>
                  <span className="text-xs text-ink-soft">
                    교직원 {staffCountBySchool.get(school.id) ?? 0}명
                  </span>
                </li>
              ))}
            </ul>
          </Card>
        ) : null}
      </div>
    </>
  )
}
