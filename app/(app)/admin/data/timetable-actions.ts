'use server'

import { revalidatePath } from 'next/cache'
import { getCurrentTerm } from '@/lib/data/context'
import { parseTimetableRows, type TimetableImportContext } from '@/lib/import/timetable'
import { readTimetableWorkbook } from '@/lib/import/timetable-xlsx'
import { AUDIT_ACTIONS, writeAudit } from '@/lib/security/audit'
import type { CourseLevel } from '@/lib/scheduling/types'
import { createClient, isAdmin, requireSession, type TypedClient } from '@/lib/supabase/server'

async function requireAdmin() {
  const session = await requireSession()
  if (!isAdmin(session.profile)) throw new Error('FORBIDDEN')
  return session
}

async function buildContext(
  supabase: TypedClient,
  schoolId: string,
  termId: string,
): Promise<TimetableImportContext> {
  const [classesRes, subjectsRes, roomsRes, profilesRes, periodsRes, slotsRes] = await Promise.all([
    supabase.from('classes').select('id, name, course').eq('school_id', schoolId),
    supabase.from('subjects').select('id, name').eq('school_id', schoolId),
    supabase.from('rooms').select('id, name').eq('school_id', schoolId),
    supabase.from('profiles').select('id, name').eq('school_id', schoolId).eq('is_active', true),
    supabase.from('periods').select('course, period_no, starts_min, ends_min').eq('school_id', schoolId),
    supabase
      .from('timetable_slots')
      .select('class_id, day_of_week, period_no, teacher_id, co_teacher_id, starts_min, ends_min')
      .eq('term_id', termId),
  ])

  const classesByName = new Map(
    (classesRes.data ?? []).map((c) => [c.name, { id: c.id, course: c.course as CourseLevel }]),
  )
  const subjectsByName = new Map((subjectsRes.data ?? []).map((s) => [s.name, s.id]))
  const roomsByName = new Map((roomsRes.data ?? []).map((r) => [r.name, r.id]))

  const teachersByName: TimetableImportContext['teachersByName'] = new Map()
  for (const p of profilesRes.data ?? []) {
    teachersByName.set(p.name, teachersByName.has(p.name) ? 'ambiguous' : { id: p.id, name: p.name })
  }

  const periodsByCourse = new Map<CourseLevel, Array<{ no: number; start: number; end: number }>>()
  for (const p of periodsRes.data ?? []) {
    const course = p.course as CourseLevel
    const list = periodsByCourse.get(course) ?? []
    list.push({ no: p.period_no, start: p.starts_min, end: p.ends_min })
    periodsByCourse.set(course, list)
  }

  const existingTeacherBusy = new Map<string, Array<{ day: number; start: number; end: number }>>()
  const existingClassSlots = new Set<string>()
  for (const s of slotsRes.data ?? []) {
    if (s.class_id) existingClassSlots.add(`${s.class_id}:${s.day_of_week}:${s.period_no}`)
    for (const teacherId of [s.teacher_id, s.co_teacher_id]) {
      if (!teacherId) continue
      const list = existingTeacherBusy.get(teacherId) ?? []
      list.push({ day: s.day_of_week, start: s.starts_min, end: s.ends_min })
      existingTeacherBusy.set(teacherId, list)
    }
  }

  return {
    classesByName,
    subjectsByName,
    roomsByName,
    teachersByName,
    periodsByCourse,
    existingTeacherBusy,
    existingClassSlots,
  }
}

export interface TimetableImportState {
  error?: string
  total?: number
  validCount?: number
  errors?: Array<{ row: number; message: string }>
  committed?: boolean
  insertedCount?: number
}

async function runImport(formData: FormData, commit: boolean): Promise<TimetableImportState> {
  const session = await requireAdmin()
  const file = formData.get('file')
  if (!(file instanceof File) || file.size === 0) {
    return { error: '파일을 선택해 주세요' }
  }

  const supabase = await createClient()
  const term = await getCurrentTerm(supabase, session.school.id)
  if (!term) return { error: '학기가 등록돼 있지 않습니다. 먼저 학기를 만들어 주세요.' }

  let rawRows
  try {
    const buffer = await file.arrayBuffer()
    rawRows = await readTimetableWorkbook(buffer)
  } catch {
    return { error: '파일을 읽지 못했습니다. 내려받은 양식(.xlsx)을 그대로 썼는지 확인하세요.' }
  }

  if (rawRows.length === 0) {
    return { error: '입력된 행이 없습니다' }
  }

  const ctx = await buildContext(supabase, session.school.id, term.id)
  const { valid, errors } = parseTimetableRows(rawRows, ctx)

  if (!commit) {
    return { total: rawRows.length, validCount: valid.length, errors }
  }

  if (valid.length === 0) {
    return { total: rawRows.length, validCount: 0, errors, error: '반영할 수 있는 행이 없습니다' }
  }

  const rows = valid.map((row) => ({
    school_id: session.school.id,
    term_id: term.id,
    ...row,
  }))

  const { error: insertError } = await supabase.from('timetable_slots').insert(rows as never)
  if (insertError) {
    return {
      total: rawRows.length,
      validCount: valid.length,
      errors,
      error: '반영 중 오류가 발생했습니다. 다른 사람이 방금 같은 시간표를 먼저 등록하지 않았는지 확인 후 다시 시도하세요.',
    }
  }

  await writeAudit({
    schoolId: session.school.id,
    actorId: session.userId,
    actorName: session.profile.name,
    action: AUDIT_ACTIONS.timetableImport,
    targetTable: 'timetable_slots',
    meta: { count: rows.length },
  })

  revalidatePath('/admin/data')
  revalidatePath('/timetable')

  return {
    total: rawRows.length,
    validCount: valid.length,
    errors,
    committed: true,
    insertedCount: rows.length,
  }
}

export async function previewTimetableImport(formData: FormData): Promise<TimetableImportState> {
  return runImport(formData, false)
}

export async function commitTimetableImport(formData: FormData): Promise<TimetableImportState> {
  return runImport(formData, true)
}
