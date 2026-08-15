import { redirect } from 'next/navigation'
import { Badge, Button, Card, PageHeader } from '@/components/ui'
import { loadWeights } from '@/lib/data/substitution'
import { createClient, isAdmin, requireSession } from '@/lib/supabase/server'
import { toggleFreeTextAi } from './actions'
import { InviteForm } from './invite-form'
import { SchoolKeyForm } from './school-key-form'
import { WeightsForm } from './weights-form'

const ROLE_LABEL: Record<string, string> = {
  admin: '관리자',
  manager: '부장',
  teacher: '교사',
  part_time: '시간강사',
  staff: '실무사',
}

export default async function AdminPage() {
  const session = await requireSession()
  if (!isAdmin(session.profile)) redirect('/dashboard')

  const supabase = await createClient()
  const [{ data: invitations }, { data: members }] = await Promise.all([
    supabase
      .from('invitations')
      .select('*')
      .is('accepted_at', null)
      .order('created_at', { ascending: false }),
    supabase
      .from('profiles')
      .select('id, name, role, employment, is_active')
      .eq('school_id', session.school.id)
      .order('name'),
  ])

  const { weights, longRunThreshold } = await loadWeights(supabase, session.school.id)

  return (
    <>
      <PageHeader title="학교 관리" description={session.school.name} />

      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="p-5">
          <h2 className="text-sm font-semibold">교직원 초대</h2>
          <p className="mt-1 text-sm text-ink-soft">
            직접 가입은 막혀 있습니다. 여기서 만든 링크를 본인에게 전달하세요. 링크는 72시간
            뒤에 만료됩니다.
          </p>
          <div className="mt-4">
            <InviteForm />
          </div>

          {(invitations ?? []).length > 0 ? (
            <div className="mt-5 border-t border-line pt-4">
              <p className="text-xs font-semibold text-ink-soft">아직 가입 안 한 초대</p>
              <ul className="mt-2 space-y-1.5">
                {(invitations ?? []).map((invitation) => (
                  <li key={invitation.id} className="flex items-baseline gap-2 text-sm">
                    <span className="font-medium">{invitation.name}</span>
                    <span className="text-xs text-ink-soft">{invitation.email}</span>
                    <Badge>{ROLE_LABEL[invitation.role]}</Badge>
                    <span className="ml-auto text-[11px] text-ink-soft tabular">
                      {invitation.expires_at.slice(0, 10)}까지
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </Card>

        <Card className="p-5">
          <h2 className="text-sm font-semibold">결보강 배정 기준</h2>
          <p className="mt-1 text-sm text-ink-soft">
            숫자가 클수록 먼저 추천됩니다. 학교 사정에 맞게 바꾸세요. 0으로 두면 그 항목은 보지
            않습니다.
          </p>
          <div className="mt-4">
            <WeightsForm weights={weights} longRunThreshold={longRunThreshold} />
          </div>
        </Card>

        <Card className="p-5">
          <h2 className="text-sm font-semibold">학교 공용 Gemini 키</h2>
          <p className="mt-1 text-sm leading-relaxed text-ink-soft">
            여기에 키를 넣어 두면 전 교직원이 수업 도구함을 바로 쓸 수 있습니다. 무료 키는
            하루 사용량이 정해져 있어, 사람이 몰리면 개인 키를 등록하도록 안내됩니다.
          </p>
          {session.school.gemini_key_hint ? (
            <p className="mt-3">
              <code className="rounded-lg bg-canvas px-3 py-1.5 text-sm">
                {session.school.gemini_key_hint}
              </code>
            </p>
          ) : null}
          <div className="mt-4 max-w-sm">
            <SchoolKeyForm hasKey={Boolean(session.school.gemini_key_hint)} />
          </div>
        </Card>

        <Card className="p-5">
          <h2 className="text-sm font-semibold">안내문 자유 붙여넣기</h2>
          <p className="mt-1 text-sm leading-relaxed text-ink-soft">
            기본값은 꺼짐입니다. 켜면 교사가 기존 문서를 통째로 붙여넣어 변환할 수 있습니다.
            편하지만, 붙여넣은 글에 학생 이름이나 연락처가 섞여 들어갈 위험이 생깁니다.
          </p>
          <p className="mt-2 rounded-lg bg-warn-soft px-3 py-2 text-xs leading-relaxed text-warn">
            켜더라도 전송 전에 가릴 부분을 확인하는 화면은 그대로 거칩니다. 주민등록번호와
            계좌번호는 어떤 경우에도 전송되지 않습니다.
          </p>

          <form action={toggleFreeTextAi} className="mt-4 flex items-center gap-3">
            <input
              type="hidden"
              name="enable"
              value={session.school.allow_free_text_ai ? '0' : '1'}
            />
            <Badge tone={session.school.allow_free_text_ai ? 'warn' : 'neutral'}>
              지금 {session.school.allow_free_text_ai ? '켜짐' : '꺼짐'}
            </Badge>
            <Button variant="secondary" type="submit">
              {session.school.allow_free_text_ai ? '끄기' : '켜기'}
            </Button>
          </form>
        </Card>

        <Card className="lg:col-span-2">
          <h2 className="border-b border-line px-4 py-3 text-sm font-semibold">
            교직원 {(members ?? []).length}
          </h2>
          <ul className="divide-y divide-line">
            {(members ?? []).map((member) => (
              <li key={member.id} className="flex items-center gap-3 px-4 py-2.5 text-sm">
                <span className="font-medium">{member.name}</span>
                <Badge>{ROLE_LABEL[member.role]}</Badge>
                {member.employment === 'part_time' ? <Badge tone="brand">시간강사</Badge> : null}
                {!member.is_active ? <Badge tone="danger">사용 중지</Badge> : null}
              </li>
            ))}
          </ul>
        </Card>
      </div>
    </>
  )
}
