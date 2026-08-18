import { PageHeader } from '@/components/ui'
import { TaskAnalysisForm } from './task-analysis-form'

export default function TaskAnalysisPage() {
  return (
    <>
      <PageHeader
        title="작업분석"
        description="전공과 작업을 적으면 학생이 순서대로 따라 할 수 있는 단계로 나눠 줍니다."
      />
      <TaskAnalysisForm />
    </>
  )
}
