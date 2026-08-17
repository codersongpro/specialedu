/**
 * 메뉴 구조와 민감도 등급.
 *
 * 이 파일이 네비게이션의 유일한 출처다. 화면마다 개발자가 기억해서 경고를
 * 붙이는 방식은 반드시 빠뜨리는 곳이 생기므로, 카테고리에 등급을 달고
 * 레이아웃이 자동으로 경고를 걸게 한다.
 */

export type Sensitivity = 'normal' | 'student_sensitive' | 'external_ai'

export interface NavItem {
  href: string
  label: string
  /** 아직 만들지 않은 화면. 메뉴에는 보이되 준비 중으로 표시한다. */
  planned?: boolean
  adminOnly?: boolean
}

export interface NavCategory {
  key: string
  label: string
  sensitivity: Sensitivity
  items: NavItem[]
}

export const NAV: NavCategory[] = [
  {
    key: 'today',
    label: '오늘',
    sensitivity: 'normal',
    items: [{ href: '/dashboard', label: '오늘 할 일' }],
  },
  {
    key: 'space',
    label: '시간표·공간',
    sensitivity: 'normal',
    items: [
      { href: '/rooms', label: '특별실 예약' },
      { href: '/timetable', label: '시간표 보기' },
      { href: '/equipment', label: '교구 대여' },
    ],
  },
  {
    key: 'staffing',
    label: '인력 운영',
    sensitivity: 'normal',
    items: [
      { href: '/substitutions', label: '결보강' },
      { href: '/substitutions/payroll', label: '강사료 정산', adminOnly: true },
      { href: '/staffing/assistants', label: '보조인력 배치' },
    ],
  },
  {
    key: 'calendar',
    label: '일정',
    sensitivity: 'normal',
    items: [
      { href: '/calendar', label: '학사일정·행사' },
      { href: '/calendar/trips', label: '현장체험학습' },
    ],
  },
  {
    key: 'budget',
    label: '살림',
    sensitivity: 'normal',
    items: [{ href: '/budget', label: '학급·부서 예산' }],
  },
  {
    key: 'student',
    label: '학생 지원',
    sensitivity: 'student_sensitive',
    items: [
      { href: '/support/pbs', label: 'PBS 기록' },
      { href: '/support/iep', label: 'IEP 목표' },
      { href: '/support/safety', label: '안전 프로토콜' },
    ],
  },
  {
    key: 'toolbox',
    label: '수업 도구함',
    sensitivity: 'external_ai',
    items: [
      { href: '/toolbox/easy-read', label: '쉬운글 안내문' },
      { href: '/toolbox/media', label: '수업 자료 찾기' },
    ],
  },
  {
    key: 'settings',
    label: '설정',
    sensitivity: 'normal',
    items: [
      { href: '/settings', label: '내 설정' },
      { href: '/admin', label: '학교 관리', adminOnly: true },
      { href: '/admin/data', label: '기준정보 관리', adminOnly: true },
      { href: '/admin/audit', label: '접속 기록', adminOnly: true },
      { href: '/help', label: '사용 설명서' },
    ],
  },
]

export interface ZoneWarning {
  title: string
  body: string
  /** 상단에 항상 띄워 둘 한 줄 */
  banner: string
}

export const ZONE_WARNINGS: Record<Exclude<Sensitivity, 'normal'>, ZoneWarning> = {
  student_sensitive: {
    title: '학생 민감정보를 다루는 화면입니다',
    body:
      '장애 관련 정보는 개인정보보호법상 민감정보입니다. 화면을 켜 둔 채 자리를 비우지 마세요. ' +
      '이 구역에서 조회하거나 고친 내용은 접속 기록에 남습니다.',
    banner: '민감정보 구역 · 조회 기록이 남습니다',
  },
  external_ai: {
    title: '입력한 내용이 외부 AI로 전송됩니다',
    body:
      '무료 Gemini API는 전송한 내용이 학습에 쓰일 수 있고 사람이 읽을 수도 있습니다. ' +
      '학생 이름, 연락처, 주소는 넣지 마세요. 보내기 전에 무엇이 나가는지 미리 확인할 수 있습니다.',
    banner: '외부 AI 전송 · 학생 이름과 연락처는 넣지 마세요',
  },
}

/** 민감 구역은 자리를 비웠을 때 위험이 크므로 더 짧게 끊는다 (분) */
export const SESSION_TIMEOUT_MIN: Record<Sensitivity, number> = {
  normal: 120,
  student_sensitive: 20,
  external_ai: 60,
}

export function categoryForPath(pathname: string): NavCategory | undefined {
  let best: NavCategory | undefined
  let bestLength = -1
  for (const category of NAV) {
    for (const item of category.items) {
      if (pathname === item.href || pathname.startsWith(`${item.href}/`)) {
        if (item.href.length > bestLength) {
          best = category
          bestLength = item.href.length
        }
      }
    }
  }
  return best
}

export function sensitivityForPath(pathname: string): Sensitivity {
  return categoryForPath(pathname)?.sensitivity ?? 'normal'
}

export function visibleNav(isAdmin: boolean): NavCategory[] {
  return NAV.map((category) => ({
    ...category,
    items: category.items.filter((item) => !item.adminOnly || isAdmin),
  })).filter((category) => category.items.length > 0)
}
