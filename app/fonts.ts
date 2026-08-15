import localFont from 'next/font/local'

/**
 * Pretendard 자체 호스팅.
 *
 * 참고 디자인이 CDN(jsdelivr)에서 불러왔지만, 우리 CSP(next.config.ts)가
 * 외부 폰트 출처를 막고 있어 그대로 가져오면 차단된다. npm 패키지
 * `pretendard` 에 실제 파일이 들어 있어 CDN 없이 그대로 쓸 수 있다.
 *
 * 전체 글리프가 든 정적 파일은 weight 하나당 700KB가 넘어 셋만 합쳐도
 * 2MB를 넘는다. 한글·영문·기호로 줄인 subset 파일은 weight당 260KB대라
 * 이쪽을 쓴다. 실제로 쓰는 굵기(400 본문·500 medium·600 semibold)만
 * 넣었다 — bold(700)는 코드 어디서도 안 쓴다.
 */
export const pretendard = localFont({
  src: [
    {
      path: '../node_modules/pretendard/dist/web/static/woff2-subset/Pretendard-Regular.subset.woff2',
      weight: '400',
      style: 'normal',
    },
    {
      path: '../node_modules/pretendard/dist/web/static/woff2-subset/Pretendard-Medium.subset.woff2',
      weight: '500',
      style: 'normal',
    },
    {
      path: '../node_modules/pretendard/dist/web/static/woff2-subset/Pretendard-SemiBold.subset.woff2',
      weight: '600',
      style: 'normal',
    },
  ],
  variable: '--font-pretendard',
  display: 'swap',
})
