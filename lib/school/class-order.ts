import type { CourseLevel } from '@/lib/scheduling/types'

/** 초등 → 중학 → 고등 → 전공과 순서. 학급 고르기 화면에서 전부 이 순서를 따른다. */
export const COURSE_ORDER: CourseLevel[] = ['elementary', 'middle', 'high', 'vocational']

export function sortClassesByCourseGrade<T extends { course: CourseLevel; grade: number }>(
  classes: readonly T[],
): T[] {
  return [...classes].sort((a, b) => {
    const courseDiff = COURSE_ORDER.indexOf(a.course) - COURSE_ORDER.indexOf(b.course)
    if (courseDiff !== 0) return courseDiff
    return a.grade - b.grade
  })
}
