import { Button, Card, EmptyState, PageHeader } from '@/components/ui'
import { createClient, requireSession } from '@/lib/supabase/server'
import { deletePersonalDraft } from './actions'

const TOOL_LABEL: Record<string, string> = { lesson_adapt: '수준별 수업 변환기', video_kit: '영상 수업 꾸러미', document_checklist: '공문·매뉴얼 체크리스트', trip_plan: '행사·체험학습 운영표', meeting_notes: '회의 메모 정리' }

export default async function PersonalDraftsPage() {
  const session = await requireSession()
  const supabase = await createClient()
  const { data: drafts } = await supabase.from('personal_drafts').select('id, tool, title, content, created_at, updated_at').eq('owner_id', session.userId).order('updated_at', { ascending: false })
  return <>
    <PageHeader title="내 AI 초안" description="AI가 만든 검토용 결과만 저장합니다. 원본 입력과 첨부 자료는 저장하지 않습니다." />
    {!drafts?.length ? <EmptyState title="저장한 초안이 없습니다" hint="수준별 수업 변환기나 영상 수업 꾸러미에서 결과를 만들면 여기에만 저장됩니다." /> : <div className="space-y-4">{drafts.map((draft) => <Card key={draft.id} className="p-5"><div className="flex flex-wrap items-start justify-between gap-3"><div><p className="text-xs text-ink-soft">{TOOL_LABEL[draft.tool] ?? draft.tool} · {new Date(draft.updated_at).toLocaleDateString('ko-KR')}</p><h2 className="mt-1 font-semibold">{draft.title}</h2></div><form action={deletePersonalDraft}><input type="hidden" name="id" value={draft.id} /><Button type="submit" variant="secondary">영구 삭제</Button></form></div><div className="mt-4 whitespace-pre-wrap text-sm leading-7">{draft.content}</div></Card>)}</div>}
  </>
}
