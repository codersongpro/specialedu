import type { NextConfig } from 'next'

/**
 * 보안 헤더.
 *
 * CSP는 Next.js가 인라인 스타일/스크립트를 쓰기 때문에 'unsafe-inline'이 필요합니다.
 * connect-src는 Supabase 도메인만 허용해, 설령 XSS가 나더라도 데이터가
 * 임의의 외부 서버로 빠져나가지 못하게 막습니다.
 */
const supabaseHttpOrigin = (() => {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  if (!url) return ''
  try {
    return new URL(url).origin
  } catch {
    return ''
  }
})()
const supabaseOrigin = supabaseHttpOrigin
  ? `${supabaseHttpOrigin} ${supabaseHttpOrigin.replace('https://', 'wss://')}`
  : ''

// 'unsafe-eval'은 개발 모드 Fast Refresh/HMR에 필요하지만, 운영에서는
// eval 기반 XSS 페이로드를 그대로 실행시켜 줄 뿐 실사용 코드에는 필요 없다.
// 운영 빌드에서만 뺀다.
const scriptSrc =
  process.env.NODE_ENV === 'production'
    ? "script-src 'self' 'unsafe-inline'"
    : "script-src 'self' 'unsafe-inline' 'unsafe-eval'"

const csp = [
  "default-src 'self'",
  scriptSrc,
  "style-src 'self' 'unsafe-inline'",
  // 영수증 첨부(Supabase Storage 서명 URL)를 <img> 로 보여줘야 해서 img-src 에도 Supabase 오리진이 필요하다
  `img-src 'self' data: blob: https://static.arasaac.org https://i.ytimg.com ${supabaseHttpOrigin}`.trim(),
  "font-src 'self' data:",
  `connect-src 'self' ${supabaseOrigin}`.trim(),
  "frame-src https://www.youtube-nocookie.com",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
].join('; ')

const securityHeaders = [
  { key: 'Content-Security-Policy', value: csp },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
  {
    key: 'Strict-Transport-Security',
    value: 'max-age=63072000; includeSubDomains; preload',
  },
]

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  typedRoutes: false,
  // 영수증 사진(휴대폰 카메라 촬영분)은 1MB 를 쉽게 넘는다 — 기본값보다 넉넉하게
  experimental: {
    serverActions: { bodySizeLimit: '8mb' },
  },
  async headers() {
    return [{ source: '/:path*', headers: securityHeaders }]
  },
}

export default nextConfig
