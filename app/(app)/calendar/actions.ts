'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { AUDIT_ACTIONS, writeAudit } from '@/lib/security/audit'
import { createClient, requireSession } from '@/lib/supabase/server'

const EventInput = z.object({
  title: z.string().min(1, '행사 이름을 적어 주세요').max(120),
  detail: z.string().max(500).optional(),
  startsOn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  endsOn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  scope: z.enum(['school', 'course', 'grade', 'class', 'department']),
  scopeCourse: z.enum(['elementary', 'middle', 'high', 'vocational']).nullable(),
  scopeGrade: z.coerce.number().int().min(1).max(6).nullable(),
  scopeClassId: z.string().uuid().nullable(),
  category: z.enum([
    'academic',
    'grade_event',
    'course_event',
    'class_event',
    'exam',
    'vacation',
    'holiday',
    'training',
    'other',
  ]),
})

export interface EventState {
  error?: string
  ok?: boolean
}

export async function createEvent(_prev: EventState, formData: FormData): Promise<EventState> {
  const session = await requireSession()

  const parsed = EventInput.safeParse({
    title: formData.get('title'),
    detail: formData.get('detail') || undefined,
    startsOn: formData.get('startsOn'),
    endsOn: formData.get('endsOn') || formData.get('startsOn'),
    scope: formData.get('scope'),
    scopeCourse: emptyToNull(formData.get('scopeCourse')),
    scopeGrade: emptyToNull(formData.get('scopeGrade')),
    scopeClassId: emptyToNull(formData.get('scopeClassId')),
    category: formData.get('category'),
  })

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? '입력을 확인하세요' }
  }
  const input = parsed.data

  if (input.endsOn < input.startsOn) return { error: '끝나는 날이 시작일보다 빠릅니다' }

  // 범위별로 필요한 값이 빠지지 않았는지. DB 제약도 있지만 여기서 먼저 걸러 준다.
  if (input.scope === 'course' && !input.scopeCourse) return { error: '과정을 골라 주세요' }
  if (input.scope === 'grade' && (!input.scopeCourse || !input.scopeGrade)) {
    return { error: '과정과 학년을 골라 주세요' }
  }
  if (input.scope === 'class' && !input.scopeClassId) return { error: '학급을 골라 주세요' }

  const supabase = await createClient()
  const { error } = await supabase.from('academic_events').insert({
    school_id: session.school.id,
    title: input.title,
    detail: input.detail ?? null,
    starts_on: input.startsOn,
    ends_on: input.endsOn,
    all_day: true,
    scope: input.scope,
    scope_course: input.scope === 'course' || input.scope === 'grade' ? input.scopeCourse : null,
    scope_grade: input.scope === 'grade' ? input.scopeGrade : null,
    scope_class_id: input.scope === 'class' ? input.scopeClassId : null,
    scope_department_id: null,
    category: input.category,
    source: 'manual',
    created_by: session.userId,
  })

  if (error) {
    // RLS 에 걸리면 여기로 온다 — 담임이 아닌 학급 행사를 넣으려 한 경우
    return { error: '등록할 수 없습니다. 담임인 학급의 행사만 넣을 수 있습니다.' }
  }

  await writeAudit({
    schoolId: session.school.id,
    actorId: session.userId,
    actorName: session.profile.name,
    action: AUDIT_ACTIONS.eventCreate,
    targetTable: 'academic_events',
    meta: { scope: input.scope, category: input.category },
  })

  revalidatePath('/calendar')
  return { ok: true }
}

export async function deleteEvent(formData: FormData): Promise<void> {
  await requireSession()
  const id = String(formData.get('id') ?? '')
  if (!id) return

  const supabase = await createClient()
  await supabase.from('academic_events').delete().eq('id', id)
  revalidatePath('/calendar')
}

function emptyToNull(value: FormDataEntryValue | null): string | null {
  const text = typeof value === 'string' ? value.trim() : ''
  return text === '' ? null : text
}
