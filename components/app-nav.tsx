'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/cn'
import type { NavCategory } from '@/lib/security/sensitivity'

/**
 * 8개 카테고리 네비게이션.
 *
 * 민감 구역에는 점을 찍어 둔다. 메뉴에서부터 "여기는 성격이 다르다"를
 * 알 수 있어야 교사가 실수하지 않는다.
 */
export function AppNav({ categories }: { categories: NavCategory[] }) {
  const pathname = usePathname()

  return (
    <nav className="p-3">
      {categories.map((category) => (
        <div key={category.key} className="mb-4 last:mb-0">
          <p className="flex items-center gap-1.5 px-2.5 pb-1.5 text-[11px] font-semibold tracking-wide text-ink-soft">
            {category.label}
            {category.sensitivity !== 'normal' ? (
              <span
                aria-hidden
                className={cn(
                  'size-1.5 rounded-full',
                  category.sensitivity === 'student_sensitive' ? 'bg-danger' : 'bg-warn',
                )}
              />
            ) : null}
          </p>

          <ul className="space-y-0.5">
            {category.items.map((item) => {
              const active =
                pathname === item.href ||
                (item.href !== '/dashboard' && pathname.startsWith(`${item.href}/`))

              if (item.planned) {
                return (
                  <li key={item.href}>
                    <span className="flex cursor-default items-center justify-between rounded-lg px-2.5 py-1.5 text-sm text-ink-soft/60">
                      {item.label}
                      <span className="text-[10px]">준비 중</span>
                    </span>
                  </li>
                )
              }

              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    aria-current={active ? 'page' : undefined}
                    className={cn(
                      'block rounded-lg px-2.5 py-1.5 text-sm transition-colors',
                      active
                        ? 'bg-brand-soft font-medium text-brand'
                        : 'text-ink hover:bg-canvas',
                    )}
                  >
                    {item.label}
                  </Link>
                </li>
              )
            })}
          </ul>
        </div>
      ))}
    </nav>
  )
}
