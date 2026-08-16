import { formatKoreanDateWithDay } from '@/lib/date'

export interface WeeklyBriefingInput {
  weekStart: string
  lessons: number
  reservations: number
  substitutions: number
  events: string[]
  budgetItems: number
}

export function buildWeeklyBriefing(input: WeeklyBriefingInput): string {
  const workload = [
    `수업 ${input.lessons}건`, `특별실 예약 ${input.reservations}건`, `결보강 ${input.substitutions}건`, `예산 등록 ${input.budgetItems}건`,
  ].join(' · ')
  const eventLine = input.events.length ? input.events.slice(0, 8).join(', ') : '등록된 행사가 없습니다.'
  return `# ${formatKoreanDateWithDay(input.weekStart)} 주간 업무 브리핑\n\n## 이번 주 업무량\n${workload}\n\n## 행사·일정\n${eventLine}\n\n## 확인할 일\n- 월요일에 특별실 예약과 결보강 시간을 다시 확인합니다.\n- 행사 전 준비물과 담당 업무를 확인합니다.\n- 예산 등록 항목은 증빙과 집행일을 확인합니다.`
}
