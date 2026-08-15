'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/cn'
import type { NavCategory } from '@/lib/security/sensitivity'

/**
 * 카테고리별 구분색.
 *
 * 민감 구역(학생 지원·수업 도구함)은 기존에 쓰던 위험·경고 색을 그대로
 * 써서 "여기는 성격이 다르다"는 의미를 유지한다. 나머지 카테고리는
 * 메뉴끼리 한눈에 구분되도록 서로 다른 색을 하나씩 배정했다.
 */
const CATEGORY_DOT: Record<string, string> = {
  today: 'bg-sky-500',
  space: 'bg-cyan-600',
  staffing: 'bg-violet-500',
  calendar: 'bg-emerald-500',
  budget: 'bg-indigo-500',
  student: 'bg-danger',
  toolbox: 'bg-warn',
  settings: 'bg-slate-400',
}

/**
 * 8개 카테고리 네비게이션.
 *
 * 카테고리마다 점 색을 다르게 줘서 사이드바를 훑을 때 카테고리 경계가
 * 바로 눈에 들어오게 한다. 민감 구역에는 그 의미까지 겸하는 색을 쓴다.
 */
export function AppNav({ categories }: { categories: NavCategory[] }) {
  const pathname = usePathname()

  return (
    <nav className="p-3">
      {categories.map((category) => (
        <div key={category.key} className="mb-5 last:mb-0">
          <p className="flex items-center gap-1.5 px-3 pb-1.5 text-[13px] font-semibold tracking-[.02em] text-ink-soft">
            <span
              aria-hidden
              className={cn('size-[7px] shrink-0 rounded-full', CATEGORY_DOT[category.key] ?? 'bg-ink-soft')}
            />
            {category.label}
          </p>

          <ul className="space-y-0.5">
            {category.items.map((item) => {
              const active =
                pathname === item.href ||
                (item.href !== '/dashboard' && pathname.startsWith(`${item.href}/`))

              if (item.planned) {
                return (
                  <li key={item.href}>
                    <span className="flex min-h-11 cursor-default items-center justify-between rounded-lg px-3 text-base text-ink-soft/60">
                      {item.label}
                      <span className="text-[13px]">준비 중</span>
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
                      'flex min-h-11 items-center rounded-lg px-3 text-base transition-colors',
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
