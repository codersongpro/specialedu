import { PageHeader } from '@/components/ui'
import { IepDraftForm } from './iep-draft-form'

export default function IepDraftPage() {
  return (
    <>
      <PageHeader
        title="IEP 목표 초안"
        description="영역과 현재 수준을 적으면 관찰·측정 가능한 목표 문장 후보를 만들어 줍니다. 학생 이름은 넣지 마세요 — 이 도구는 학생을 저장하지 않습니다."
      />
      <IepDraftForm />
    </>
  )
}
