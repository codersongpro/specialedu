import type { NextConfig } from 'next'

/**
 * 보안 헤더.
 *
 * CSP는 Next.js가 인라인 스타일/스크립트를 쓰기 때문에 'unsafe-inline'이 필요합니다.
 * connect-src는 Supabase 도메인만 허용해, 설령 XSS가 나더라도 데이터가
 * 임의의 외부 서버로 빠져나가지 못하게 막습니다.
 */
const supabaseOrigin = (() => {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  if (!url) return ''
  try {
    const { origin } = new URL(url)
    return `${origin} ${origin.replace('https://', 'wss://')}`
  } catch {
    return ''
  }
})()

const csp = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: https://static.arasaac.org https://i.ytimg.com",
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
  async headers() {
    return [{ source: '/:path*', headers: securityHeaders }]
  },
}

export default nextConfig
