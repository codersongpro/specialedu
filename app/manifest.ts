import type { MetadataRoute } from 'next'

/**
 * 홈 화면에 추가했을 때 브라우저 주소창 없이 앱처럼 뜨게 한다
 * (display: standalone). 아이콘은 app/icon.tsx, app/apple-icon.tsx 가
 * 자동으로 만들어 붙여준다.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: '한아름 — 특수학교 업무 지원',
    short_name: '한아름',
    description: '특별실 예약, 결보강, 학사일정을 한 곳에서',
    start_url: '/dashboard',
    display: 'standalone',
    background_color: '#f6f7f9',
    theme_color: '#1d6fd8',
    lang: 'ko',
  }
}
