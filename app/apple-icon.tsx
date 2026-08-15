import { ImageResponse } from 'next/og'

/**
 * iOS 홈 화면에 추가했을 때 쓰는 아이콘.
 * 애플은 둥근 모서리를 자체적으로 씌우므로 여기서는 꽉 찬 사각형으로 그린다.
 */

export const size = { width: 180, height: 180 }
export const contentType = 'image/png'

export default function AppleIcon() {
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
        }}
      >
        <svg width={110} height={110} viewBox="0 0 24 24" fill="none">
          <path
            d="M4.5 10.5c0 5.2 3.6 9 7.5 9s7.5-3.8 7.5-9"
            stroke="#ffffff"
            strokeWidth="2.3"
            strokeLinecap="round"
          />
          <circle cx="12" cy="6.5" r="3.1" fill="#ffffff" />
        </svg>
      </div>
    ),
    { ...size },
  )
}
