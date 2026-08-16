'use client'

import { useRouter } from 'next/navigation'
import { inputClass } from '@/components/ui'
import { cn } from '@/lib/cn'

export function MonthPicker({ month }: { month: string }) {
  const router = useRouter()

  return (
    <label className="flex items-center gap-2 text-sm">
      <span className="text-ink-soft">기준 월</span>
      <input
        type="month"
        value={month}
        onChange={(e) => router.push(`/substitutions/payroll?month=${e.target.value}`)}
        className={cn(inputClass, 'w-40')}
      />
    </label>
  )
}
