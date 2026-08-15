import { redirect } from 'next/navigation'
import { Card, EmptyState, PageHeader } from '@/components/ui'
import { createClient, isAdmin, requireSession } from '@/lib/supabase/server'

const ACTION_LABEL: Record<string, string> = {
  'auth.login': '로그인',
  'auth.invite_accept': '계정 만들기',
  'zone.sensitive_enter': '민감정보 화면 진입',
  'reservation.create': '특별실 예약',
  'reservation.cancel': '예약 취소',
  'reservation.approve': '예약 승인·반려',
  'absence.create': '결과 신청',
  'substitution.assign': '결보강 배정',
  'event.create': '행사 등록',
  'ai.request': 'AI 도구 사용',
  'export.download': '자료 내려받기',
}

export default async function AuditPage() {
  const session = await requireSession()
  if (!isAdmin(session.profile)) redirect('/dashboard')

  const supabase = await createClient()
  const { data: logs } = await supabase
    .from('audit_logs')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(200)

  return (
    <>
      <PageHeader
        title="접속 기록"
        description="누가 언제 무엇을 했는지 남습니다. 2년 뒤 자동으로 지워집니다."
      />

      <Card className="overflow-x-auto">
        {(logs ?? []).length === 0 ? (
          <EmptyState title="기록이 없습니다" />
        ) : (
          <table className="w-full min-w-[640px] border-collapse text-sm">
            <thead>
              <tr className="border-b border-line">
                <th className="px-4 py-2.5 text-left text-xs font-semibold text-ink-soft">시각</th>
                <th className="px-4 py-2.5 text-left text-xs font-semibold text-ink-soft">사람</th>
                <th className="px-4 py-2.5 text-left text-xs font-semibold text-ink-soft">한 일</th>
                <th className="px-4 py-2.5 text-left text-xs font-semibold text-ink-soft">접속지</th>
              </tr>
            </thead>
            <tbody>
              {(logs ?? []).map((log) => (
                <tr key={log.id} className="border-b border-line last:border-0">
                  <td className="px-4 py-2 text-xs text-ink-soft tabular">
                    {log.created_at.slice(0, 16).replace('T', ' ')}
                  </td>
                  <td className="px-4 py-2">{log.actor_name ?? '—'}</td>
                  <td className="px-4 py-2">{ACTION_LABEL[log.action] ?? log.action}</td>
                  <td className="px-4 py-2 text-xs text-ink-soft tabular">{log.ip ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>

      <p className="mt-3 text-xs text-ink-soft">
        기록에는 무엇을 봤는지만 남고, 그 안에 적힌 내용은 남지 않습니다.
      </p>
    </>
  )
}
