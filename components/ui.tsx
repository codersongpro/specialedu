import { cn } from '@/lib/cn'

/** 화면 전반에서 쓰는 최소한의 조각들 */

export function Card({
  className,
  children,
}: {
  className?: string
  children: React.ReactNode
}) {
  return (
    <div className={cn('rounded-xl border border-line bg-surface', className)}>{children}</div>
  )
}

export function PageHeader({
  title,
  description,
  actions,
}: {
  title: string
  description?: string
  actions?: React.ReactNode
}) {
  return (
    <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
      <div>
        <h1 className="text-[22px] font-semibold tracking-[-0.01em]">{title}</h1>
        {description ? (
          <p className="mt-1.5 text-[15px] text-ink-soft">{description}</p>
        ) : null}
      </div>
      {actions ? <div className="flex flex-wrap gap-2">{actions}</div> : null}
    </div>
  )
}

const BUTTON_STYLES = {
  primary: 'bg-brand text-white hover:bg-brand/90',
  secondary: 'border border-line bg-surface hover:bg-canvas',
  danger: 'border border-danger/30 bg-danger-soft text-danger hover:bg-danger/10',
} as const

export function Button({
  variant = 'primary',
  className,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: keyof typeof BUTTON_STYLES
}) {
  return (
    <button
      {...props}
      className={cn(
        // h-11(44px)는 애플·구글이 권장하는 최소 터치 영역이다. 화면이 좁은
        // 곳에서 버튼을 눌러야 하는 교직원이 많아서 기본값을 여기 맞췄다.
        'inline-flex h-11 items-center justify-center rounded-lg px-4 text-base font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50',
        BUTTON_STYLES[variant],
        className,
      )}
    />
  )
}

const BADGE_STYLES = {
  neutral: 'bg-canvas text-ink-soft',
  brand: 'bg-brand-soft text-brand',
  ok: 'bg-ok-soft text-ok',
  warn: 'bg-warn-soft text-warn',
  danger: 'bg-danger-soft text-danger',
} as const

export function Badge({
  tone = 'neutral',
  className,
  children,
}: {
  tone?: keyof typeof BADGE_STYLES
  className?: string
  children: React.ReactNode
}) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-md px-1.5 py-0.5 text-xs font-medium',
        BADGE_STYLES[tone],
        className,
      )}
    >
      {children}
    </span>
  )
}

export function Field({
  label,
  hint,
  htmlFor,
  children,
}: {
  label: string
  hint?: string
  htmlFor?: string
  children: React.ReactNode
}) {
  return (
    <div className="space-y-1.5">
      <label htmlFor={htmlFor} className="block text-[15px] font-medium">
        {label}
      </label>
      {children}
      {hint ? <p className="text-[13px] text-ink-soft">{hint}</p> : null}
    </div>
  )
}

export const inputClass =
  'h-11 w-full rounded-lg border border-line bg-surface px-3.5 text-base outline-none focus:border-brand'

/** 데이터가 없을 때. "없습니다"만 띄우지 말고 다음 행동을 알려준다. */
export function EmptyState({ title, hint }: { title: string; hint?: string }) {
  return (
    <div className="px-4 py-12 text-center">
      <p className="text-sm font-medium text-ink-soft">{title}</p>
      {hint ? <p className="mt-1 text-xs text-ink-soft">{hint}</p> : null}
    </div>
  )
}
