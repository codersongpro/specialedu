import { PageHeader } from '@/components/ui'
import { SensoryAlternativesForm } from './sensory-alternatives-form'

export default function SensoryAlternativesPage() {
  return (
    <>
      <PageHeader
        title="감각특성 활동 대안"
        description="원래 활동과 고려할 감각특성을 고르면, 학습 목표는 유지하면서 감각 자극만 조정한 대안을 제안해 줍니다."
      />
      <SensoryAlternativesForm />
    </>
  )
}
