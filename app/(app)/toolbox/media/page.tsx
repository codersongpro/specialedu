import { PageHeader } from '@/components/ui'
import { createClient, requireSession } from '@/lib/supabase/server'
import { MediaSearchForm } from './media-search-form'

export default async function MediaSearchPage() {
  const session = await requireSession()
  const supabase = await createClient()

  const { data: subjects } = await supabase
    .from('subjects')
    .select('id, name')
    .eq('school_id', session.school.id)
    .order('name')

  return (
    <>
      <PageHeader
        title="수업 자료 찾기"
        description="과정·수준·주제만 고르면 유튜브에서 쓸만한 영상을 찾아 드립니다. 학생 이름은 입력하지 않습니다."
      />
      <MediaSearchForm subjects={subjects ?? []} />
    </>
  )
}
