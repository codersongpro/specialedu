import { PageHeader } from '@/components/ui'
import { SocialStoryForm } from './social-story-form'

export default function SocialStoryPage() {
  return (
    <>
      <PageHeader
        title="사회적 이야기"
        description="상황을 적으면 상황 설명·다른 사람의 마음·대처 방법 순서로 짧은 이야기를 만들어 줍니다."
      />
      <SocialStoryForm />
    </>
  )
}
