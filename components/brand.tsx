import { cn } from '@/lib/cn'

/**
 * 앱 브랜드 — 한아름.
 *
 * "한 아름"(두 팔 벌려 가득 안는다)에서 왔다. 여러 학교의 업무를 한 곳에
 * 담아낸다는 이 앱의 성격과 맞아서 고른 이름이다. 마크는 그 뜻을 그대로
 * 그린다 — 아래에서 감싸 안는 팔(호) 위에 품고 있는 것(원) 하나.
 *
 * 로그인 화면 등 앱 자체를 소개하는 곳에서는 이 컴포넌트를 쓰고,
 * 로그인 뒤 화면에서는 "한아름"은 작게, 실제로 소속된 학교 이름을
 * 크게 보여준다 — 여러 학교가 함께 쓰는 서비스이므로 그게 맞다.
 */

const SIZES = {
  sm: { box: 24, icon: 14, gap: 'gap-1.5', word: 'text-[15px]' },
  md: { box: 32, icon: 19, gap: 'gap-2', word: 'text-[19px]' },
  lg: { box: 44, icon: 26, gap: 'gap-2.5', word: 'text-[26px]' },
} as const

export function AppMark({
  size = 28,
  className,
}: {
  size?: number
  className?: string
}) {
  return (
    <span
      aria-hidden
      style={{ width: size, height: size }}
      className={cn(
        'inline-flex shrink-0 items-center justify-center rounded-[28%] bg-brand-soft',
        className,
      )}
    >
      <svg
        width={size * 0.6}
        height={size * 0.6}
        viewBox="0 0 24 24"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <path
          d="M4.5 10.5c0 5.2 3.6 9 7.5 9s7.5-3.8 7.5-9"
          stroke="#1d6fd8"
          strokeWidth="2.3"
          strokeLinecap="round"
        />
        <circle cx="12" cy="6.5" r="3.1" fill="#1d6fd8" />
      </svg>
    </span>
  )
}

export function AppWordmark({ className }: { className?: string }) {
  return (
    <span className={cn('font-semibold tracking-[-0.01em]', className)}>한아름</span>
  )
}

/** 마크 + 워드마크를 함께 쓰는 자리 (로그인·초대·설정 화면 등) */
export function AppBrand({
  size = 'md',
  tagline,
  className,
}: {
  size?: keyof typeof SIZES
  tagline?: string
  className?: string
}) {
  const s = SIZES[size]
  return (
    <div className={cn('flex items-center', s.gap, className)}>
      <AppMark size={s.box} />
      <div className="min-w-0">
        <AppWordmark className={s.word} />
        {tagline ? <p className="mt-0.5 text-sm text-ink-soft">{tagline}</p> : null}
      </div>
    </div>
  )
}
