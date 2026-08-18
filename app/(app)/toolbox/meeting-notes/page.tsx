import { PageHeader } from '@/components/ui'
import { decryptSecret } from '@/lib/security/crypto'
import { createClient, requireSession } from '@/lib/supabase/server'
import { MeetingNotesPanel } from './meeting-notes-panel'

export default async function MeetingNotesPage() {
  const session = await requireSession()
  const supabase = await createClient()

  const { data: notes } = await supabase
    .from('meeting_notes')
    .select('*')
    .eq('school_id', session.school.id)
    .order('meeting_date', { ascending: false })
    .limit(30)

  const staffIds = Array.from(new Set((notes ?? []).map((n) => n.created_by).filter(Boolean))) as string[]
  const { data: staff } =
    staffIds.length > 0 ? await supabase.from('profiles').select('id, name').in('id', staffIds) : { data: [] }
  const staffName = new Map((staff ?? []).map((s) => [s.id, s.name]))

  const items = (notes ?? []).map((n) => ({
    id: n.id,
    title: n.title,
    meetingDate: n.meeting_date,
    category: n.category,
    rawText: safeDecrypt(n.raw_text_enc),
    summary: safeDecrypt(n.summary_enc),
    createdByName: (n.created_by && staffName.get(n.created_by)) || '알 수 없음',
    canDelete: n.created_by === session.userId || session.profile.role === 'admin' || session.profile.role === 'manager',
  }))

  return (
    <>
      <PageHeader
        title="협의록 정리"
        description="회의 내용을 붙여넣으면 결정사항·담당자·기한 위주로 요약해 저장합니다."
      />
      <MeetingNotesPanel items={items} />
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
