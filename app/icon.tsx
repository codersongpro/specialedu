import { ImageResponse } from 'next/og'

/**
 * 파비콘을 코드로 생성한다.
 *
 * 이미지 파일을 따로 준비하지 않고, components/brand.tsx 의 마크와 같은
 * 모양을 Satori(ImageResponse)로 그린다. Satori 는 Tailwind 클래스를
 * 못 읽고 인라인 style 만 이해하므로 브랜드 컴포넌트를 그대로 재사용하지
 * 않고 같은 모양을 다시 그렸다 — 값(색상·비례)은 동일하게 맞췄다.
 */

export const size = { width: 32, height: 32 }
export const contentType = 'image/png'

export default function Icon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: '#1d6fd8',
          borderRadius: 9,
        }}
      >
        <svg width={20} height={20} viewBox="0 0 24 24" fill="none">
          <path
            d="M4.5 10.5c0 5.2 3.6 9 7.5 9s7.5-3.8 7.5-9"
            stroke="#ffffff"
            strokeWidth="2.6"
            strokeLinecap="round"
          />
          <circle cx="12" cy="6.5" r="3.3" fill="#ffffff" />
        </svg>
      </div>
    ),
    { ...size },
  )
}
