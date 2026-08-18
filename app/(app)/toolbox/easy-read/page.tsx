import { PageHeader } from '@/components/ui'
import { decryptSecret } from '@/lib/security/crypto'
import { createClient, requireSession } from '@/lib/supabase/server'
import { NoticeArchive } from './notice-archive'
import { NoticeForm } from './notice-form'

export default async function EasyReadPage() {
  const session = await requireSession()
  const supabase = await createClient()

  const [{ data: classes }, { data: notices }] = await Promise.all([
    supabase.from('classes').select('id, name').eq('school_id', session.school.id).order('grade'),
    supabase
      .from('notices')
      .select('*')
      .eq('school_id', session.school.id)
      .order('created_at', { ascending: false })
      .limit(30),
  ])

  const staffIds = Array.from(new Set((notices ?? []).map((n) => n.created_by).filter(Boolean))) as string[]
  const { data: staff } =
    staffIds.length > 0 ? await supabase.from('profiles').select('id, name').in('id', staffIds) : { data: [] }
  const staffName = new Map((staff ?? []).map((s) => [s.id, s.name]))

  const archiveItems = (notices ?? []).map((n) => ({
    id: n.id,
    noticeType: n.notice_type,
    title: n.title,
    eventDate: n.event_date,
    place: n.place,
    audience: n.audience,
    detail: safeDecrypt(n.detail_enc),
    output: safeDecrypt(n.output_enc),
    createdByName: (n.created_by && staffName.get(n.created_by)) || '알 수 없음',
    canDelete: n.created_by === session.userId || session.profile.role === 'admin' || session.profile.role === 'manager',
    createdAt: n.created_at,
  }))

  return (
    <>
      <PageHeader
        title="쉬운글 안내문"
        description="학생 이름 없이 안내문을 만들면, 필요한 부분만 자동으로 쉽게 풀어 씁니다."
      />
      <NoticeForm classes={classes ?? []} />
      <NoticeArchive items={archiveItems} />
    </>
  )
}

function safeDecrypt(value: string | null): string {
  if (!value) return ''
  try {
    return decryptSecret(value)
  } catch {
    return ''
  }
}
