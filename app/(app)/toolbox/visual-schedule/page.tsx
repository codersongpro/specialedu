import { PageHeader } from '@/components/ui'
import { VisualScheduleForm } from './visual-schedule-form'

export default function VisualSchedulePage() {
  return (
    <>
      <PageHeader
        title="시각적 일과표"
        description="활동을 순서대로 적으면 그림과 짧은 표현으로 바꿔 일과표를 만들어 줍니다."
      />
      <VisualScheduleForm />
    </>
  )
}
