import type { Metadata, Viewport } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: { default: '한아름 — 특수학교 업무 지원', template: '%s · 한아름' },
  description: '특별실 예약, 결보강, 학사일정을 한 곳에서 — 특수학교 교직원 업무 지원',
  robots: { index: false, follow: false },
  appleWebApp: { capable: true, statusBarStyle: 'default', title: '한아름' },
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  // 모바일 브라우저 주소창·상태바 색을 브랜드 색으로 맞춘다.
  // 홈 화면에 추가하지 않고 그냥 브라우저로 열어도 앱처럼 느껴지게 하는
  // 가장 저렴하고 효과적인 방법이다.
  themeColor: '#1d6fd8',
  viewportFit: 'cover',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko">
      <body>{children}</body>
    </html>
  )
}
