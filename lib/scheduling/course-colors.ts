/**
 * 과정(초·중·고·전공과)마다 다른 색.
 *
 * 학사일정 캘린더에서 먼저 쓰던 배색을 그대로 가져왔다 — 한 앱 안에서
 * "고등은 파란색" 같은 인식이 화면마다 다르면 오히려 헷갈리므로, 과정
 * 색을 쓰는 화면은 전부 이 하나만 참조한다. 캘린더 쪽은 DB에서 온 느슨한
 * 문자열(scope_course)로 찾아 쓰므로 키 타입을 CourseLevel로 좁히지 않는다.
 */
export const COURSE_TONE: Record<string, string> = {
  elementary: 'bg-ok-soft text-ok',
  middle: 'bg-cyan-100 text-cyan-700',
  high: 'bg-brand-soft text-brand',
  vocational: 'bg-violet-100 text-violet-700',
}

export const NEUTRAL_TONE = 'bg-canvas text-ink-soft'
