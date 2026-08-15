import { addDays, format, parseISO, startOfWeek } from 'date-fns'

/** 학교는 월~금으로 돌아간다. 주 단위 화면은 전부 월요일 기준. */
export function weekStart(date: Date | string): Date {
  const base = typeof date === 'string' ? parseISO(date) : date
  return startOfWeek(base, { weekStartsOn: 1 })
}

export function weekDates(date: Date | string, days = 5): string[] {
  const start = weekStart(date)
  return Array.from({ length: days }, (_, i) => toDateString(addDays(start, i)))
}

export function toDateString(date: Date): string {
  return format(date, 'yyyy-MM-dd')
}

export function todayString(): string {
  return toDateString(new Date())
}

export function shiftDays(dateString: string, days: number): string {
  return toDateString(addDays(parseISO(dateString), days))
}

export function shiftWeeks(dateString: string, weeks: number): string {
  return shiftDays(dateString, weeks * 7)
}

export function shiftMonths(dateString: string, months: number): string {
  const date = parseISO(dateString)
  return toDateString(new Date(date.getFullYear(), date.getMonth() + months, 1))
}

const DAY_NAMES = ['일', '월', '화', '수', '목', '금', '토'] as const

/** ISO 요일 (1=월 … 7=일) */
export function isoDayOfWeek(dateString: string): number {
  const day = parseISO(dateString).getDay()
  return day === 0 ? 7 : day
}

export function dayName(dateString: string): string {
  return DAY_NAMES[parseISO(dateString).getDay()] ?? ''
}

export function formatKoreanDate(dateString: string): string {
  return format(parseISO(dateString), 'M월 d일')
}

export function formatKoreanDateWithDay(dateString: string): string {
  return `${formatKoreanDate(dateString)}(${dayName(dateString)})`
}

export function isWeekend(dateString: string): boolean {
  const day = parseISO(dateString).getDay()
  return day === 0 || day === 6
}
