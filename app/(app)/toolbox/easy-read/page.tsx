import { PageHeader } from '@/components/ui'
import { createClient, requireSession } from '@/lib/supabase/server'
import { NoticeForm } from './notice-form'

export default async function EasyReadPage() {
  const session = await requireSession()
  const supabase = await createClient()

  const { data: classes } = await supabase
    .from('classes')
    .select('id, name')
    .eq('school_id', session.school.id)
    .order('grade')

  return (
    <>
      <PageHeader
        title="쉬운글 안내문"
        description="학생 이름 없이 안내문을 만들면, 필요한 부분만 자동으로 쉽게 풀어 씁니다."
      />
      <NoticeForm classes={classes ?? []} />
    </>
  )
}
