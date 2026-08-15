'use client'

import { useRouter } from 'next/navigation'
import { Field, inputClass } from '@/components/ui'

export function TimetableFilter({
  classes,
  teachers,
  classId,
  teacherId,
}: {
  classes: Array<{ id: string; name: string }>
  teachers: Array<{ id: string; name: string }>
  classId?: string
  teacherId?: string
}) {
  const router = useRouter()

  return (
    <div className="grid gap-3 sm:grid-cols-2 sm:max-w-lg">
      <Field label="선생님으로 보기" htmlFor="teacherId">
        <select
          id="teacherId"
          value={classId ? '' : (teacherId ?? '')}
          onChange={(e) =>
            router.push(e.target.value ? `/timetable?teacherId=${e.target.value}` : '/timetable')
          }
          className={inputClass}
        >
          <option value="">고르세요</option>
          {teachers.map((t) => (
            <option key={t.id} value={t.id}>
              {t.name}
            </option>
          ))}
        </select>
      </Field>

      <Field label="학급으로 보기" htmlFor="classId">
        <select
          id="classId"
          value={classId ?? ''}
          onChange={(e) =>
            router.push(e.target.value ? `/timetable?classId=${e.target.value}` : '/timetable')
          }
          className={inputClass}
        >
          <option value="">고르세요</option>
          {classes.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      </Field>
    </div>
  )
}
