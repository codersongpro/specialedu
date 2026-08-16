import { PageHeader } from '@/components/ui'
import { LessonAdaptForm } from './lesson-adapt-form'

export default function LessonAdaptPage() {
  return (
    <>
      <PageHeader title="수준별 수업 변환기" description="학생 이름·진단명·연락처 없이 수업 자료를 수준에 맞게 바꿉니다." />
      <LessonAdaptForm />
    </>
  )
}
