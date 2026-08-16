'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/cn'
import type { NavCategory } from '@/lib/security/sensitivity'

/**
 * 카테고리별 색.
 *
 * 메뉴 항목 자체를 카테고리 색으로 채운 버튼으로 만든다 — 예전에는 카테고리
 * 이름 옆 작은 점 하나로만 구분했는데, 사이드바를 훑을 때 어디서부터
 * 어디까지가 한 카테고리인지 점만으로는 잘 안 들어와서 항목 하나하나를
 * 색칠했다. 민감 구역(학생 지원·수업 도구함)은 기존에 쓰던 위험·경고
 * 색을 그대로 써서 "여기는 성격이 다르다"는 의미를 유지한다.
 */
const CATEGORY_STYLE: Record<string, { idle: string; active: string }> = {
  today: {
    idle: 'bg-sky-50 text-sky-700 hover:bg-sky-100',
    active: 'bg-sky-100 font-medium text-sky-800',
  },
  space: {
    idle: 'bg-cyan-50 text-cyan-700 hover:bg-cyan-100',
    active: 'bg-cyan-100 font-medium text-cyan-800',
  },
  staffing: {
    idle: 'bg-violet-50 text-violet-700 hover:bg-violet-100',
    active: 'bg-violet-100 font-medium text-violet-800',
  },
  calendar: {
    idle: 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100',
    active: 'bg-emerald-100 font-medium text-emerald-800',
  },
  budget: {
    idle: 'bg-indigo-50 text-indigo-700 hover:bg-indigo-100',
    active: 'bg-indigo-100 font-medium text-indigo-800',
  },
  student: {
    idle: 'bg-danger-soft text-danger hover:bg-danger-soft',
    active: 'bg-danger-soft font-semibold text-danger',
  },
  toolbox: {
    idle: 'bg-warn-soft text-warn hover:bg-warn-soft',
    active: 'bg-warn-soft font-semibold text-warn',
  },
  settings: {
    idle: 'bg-slate-50 text-slate-700 hover:bg-slate-100',
    active: 'bg-slate-100 font-medium text-slate-800',
  },
}

const DEFAULT_STYLE = { idle: 'text-ink hover:bg-canvas', active: 'bg-brand-soft font-medium text-brand' }

/**
 * 8개 카테고리 네비게이션.
 *
 * 카테고리마다 메뉴 항목을 색이 다른 버튼으로 그려 사이드바를 훑을 때
 * 카테고리 경계가 바로 눈에 들어오게 한다. 민감 구역에는 그 의미까지
 * 겸하는 색을 쓴다.
 */
export function AppNav({ categories }: { categories: NavCategory[] }) {
  const pathname = usePathname()

  return (
    <nav className="p-3">
      {categories.map((category) => {
        const style = CATEGORY_STYLE[category.key] ?? DEFAULT_STYLE

        return (
          <div key={category.key} className="mb-5 last:mb-0">
            <p className="px-3 pb-1.5 text-[13px] font-semibold tracking-[.02em] text-ink-soft">
              {category.label}
            </p>

            <ul className="space-y-1">
              {category.items.map((item) => {
                const active =
                  pathname === item.href ||
                  (item.href !== '/dashboard' && pathname.startsWith(`${item.href}/`))

                if (item.planned) {
                  return (
                    <li key={item.href}>
                      <span className="flex min-h-11 cursor-default items-center justify-between rounded-lg bg-canvas px-3 text-base text-ink-soft/60">
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
                        active ? style.active : style.idle,
                      )}
                    >
                      {item.label}
                    </Link>
                  </li>
                )
              })}
            </ul>
          </div>
        )
      })}
    </nav>
  )
}
