import { PageHeader } from '@/components/ui'
import { MaterialLevelsForm } from './material-levels-form'

export default function MaterialLevelsPage() {
  return (
    <>
      <PageHeader
        title="수업자료 난이도 변환"
        description="원본 자료를 붙여넣으면 상·중·하 3단계 수준으로 다시 써 줍니다."
      />
      <MaterialLevelsForm />
    </>
  )
}
