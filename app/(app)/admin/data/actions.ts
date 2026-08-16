'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { createClient, isAdmin, requireSession } from '@/lib/supabase/server'

export interface FormResult {
  ok?: boolean
  error?: string
}

async function requireAdmin() {
  const session = await requireSession()
  if (!isAdmin(session.profile)) throw new Error('FORBIDDEN')
  return session
}

function revalidate() {
  revalidatePath('/admin/data')
}

// --- 부서 -------------------------------------------------------------------
const DepartmentInput = z.object({
  name: z.string().min(1, '이름을 적어 주세요').max(40),
  headId: z.string().uuid().nullable(),
})

export async function saveDepartment(
  id: string | null,
  input: z.input<typeof DepartmentInput>,
): Promise<FormResult> {
  const session = await requireAdmin()
  const parsed = DepartmentInput.safeParse(input)
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? '입력을 확인하세요' }

  const supabase = await createClient()
  const row = { school_id: session.school.id, name: parsed.data.name, head_id: parsed.data.headId }
  const { error } = id
    ? await supabase.from('departments').update(row).eq('id', id)
    : await supabase.from('departments').insert(row)

  if (error) return { error: '저장하지 못했습니다. 이름이 겹치지 않는지 확인하세요.' }
  revalidate()
  return { ok: true }
}

export async function deleteDepartment(id: string): Promise<FormResult> {
  await requireAdmin()
  const supabase = await createClient()
  const { error } = await supabase.from('departments').delete().eq('id', id)
  if (error) return { error: '지우지 못했습니다' }
  revalidate()
  return { ok: true }
}

// --- 교과 -------------------------------------------------------------------
const SubjectInput = z.object({ name: z.string().min(1, '이름을 적어 주세요').max(40) })

export async function saveSubject(id: string | null, input: z.input<typeof SubjectInput>): Promise<FormResult> {
  const session = await requireAdmin()
  const parsed = SubjectInput.safeParse(input)
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? '입력을 확인하세요' }

  const supabase = await createClient()
  const row = { school_id: session.school.id, name: parsed.data.name }
  const { error } = id
    ? await supabase.from('subjects').update(row).eq('id', id)
    : await supabase.from('subjects').insert(row)

  if (error) return { error: '저장하지 못했습니다. 이름이 겹치지 않는지 확인하세요.' }
  revalidate()
  return { ok: true }
}

export async function deleteSubject(id: string): Promise<FormResult> {
  await requireAdmin()
  const supabase = await createClient()
  const { error } = await supabase.from('subjects').delete().eq('id', id)
  if (error) return { error: '지우지 못했습니다' }
  revalidate()
  return { ok: true }
}

// --- 학급 -------------------------------------------------------------------
const ClassInput = z.object({
  course: z.enum(['elementary', 'middle', 'high', 'vocational']),
  grade: z.coerce.number().int().min(1).max(6),
  name: z.string().min(1, '이름을 적어 주세요').max(40),
  homeroomTeacherId: z.string().uuid().nullable(),
  assistantTeacherId: z.string().uuid().nullable(),
  studentCount: z.coerce.number().int().min(0).max(60),
})

export async function saveClass(id: string | null, input: z.input<typeof ClassInput>): Promise<FormResult> {
  const session = await requireAdmin()
  const parsed = ClassInput.safeParse(input)
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? '입력을 확인하세요' }

  const supabase = await createClient()
  const row = {
    school_id: session.school.id,
    course: parsed.data.course,
    grade: parsed.data.grade,
    name: parsed.data.name,
    homeroom_teacher_id: parsed.data.homeroomTeacherId,
    assistant_teacher_id: parsed.data.assistantTeacherId,
    student_count: parsed.data.studentCount,
  }
  const { error } = id
    ? await supabase.from('classes').update(row).eq('id', id)
    : await supabase.from('classes').insert(row)

  if (error) return { error: '저장하지 못했습니다. 같은 과정·학년·이름이 이미 있는지 확인하세요.' }
  revalidate()
  return { ok: true }
}

export async function deleteClass(id: string): Promise<FormResult> {
  await requireAdmin()
  const supabase = await createClient()
  const { error } = await supabase.from('classes').delete().eq('id', id)
  if (error) return { error: '지우지 못했습니다. 이 학급을 참조하는 시간표·학생이 있는지 확인하세요.' }
  revalidate()
  return { ok: true }
}

// --- 특별실 -----------------------------------------------------------------
const RoomInput = z.object({
  name: z.string().min(1, '이름을 적어 주세요').max(40),
  roomType: z.string().min(1).max(30),
  floor: z.coerce.number().int().optional(),
  capacity: z.coerce.number().int().min(0).optional(),
  features: z.array(z.string().max(20)).max(15),
  managedBy: z.string().uuid().nullable(),
  requiresApproval: z.boolean(),
})

export async function saveRoom(id: string | null, input: z.input<typeof RoomInput>): Promise<FormResult> {
  const session = await requireAdmin()
  const parsed = RoomInput.safeParse(input)
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? '입력을 확인하세요' }

  const supabase = await createClient()
  const row = {
    school_id: session.school.id,
    name: parsed.data.name,
    room_type: parsed.data.roomType,
    floor: parsed.data.floor ?? null,
    capacity: parsed.data.capacity ?? null,
    features: parsed.data.features,
    managed_by: parsed.data.managedBy,
    requires_approval: parsed.data.requiresApproval,
  }
  const { error } = id
    ? await supabase.from('rooms').update(row).eq('id', id)
    : await supabase.from('rooms').insert(row)

  if (error) return { error: '저장하지 못했습니다. 이름이 겹치지 않는지 확인하세요.' }
  revalidate()
  return { ok: true }
}

export async function toggleRoomActive(id: string, isActive: boolean): Promise<void> {
  await requireAdmin()
  const supabase = await createClient()
  await supabase.from('rooms').update({ is_active: isActive }).eq('id', id)
  revalidate()
}

export async function deleteRoom(id: string): Promise<FormResult> {
  await requireAdmin()
  const supabase = await createClient()
  const { error } = await supabase.from('rooms').delete().eq('id', id)
  if (error) return { error: '지우지 못했습니다. 이 방의 예약 기록이 남아 있으면 대신 "사용 중지"를 쓰세요.' }
  revalidate()
  return { ok: true }
}

// --- 학생(가명) ---------------------------------------------------------------
const StudentInput = z.object({
  classId: z.string().uuid('학급을 골라 주세요'),
  studentCode: z.string().min(1, '학번을 적어 주세요').max(20),
  displayName: z.string().min(1, '별칭을 적어 주세요').max(40),
})

export async function saveStudent(id: string | null, input: z.input<typeof StudentInput>): Promise<FormResult> {
  const session = await requireAdmin()
  const parsed = StudentInput.safeParse(input)
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? '입력을 확인하세요' }

  const supabase = await createClient()
  const row = {
    school_id: session.school.id,
    class_id: parsed.data.classId,
    student_code: parsed.data.studentCode,
    display_name: parsed.data.displayName,
  }
  const { error } = id
    ? await supabase.from('students').update(row).eq('id', id)
    : await supabase.from('students').insert(row)

  if (error) return { error: '저장하지 못했습니다. 학번이 겹치지 않는지 확인하세요.' }
  revalidate()
  return { ok: true }
}

export async function toggleStudentActive(id: string, isActive: boolean): Promise<void> {
  await requireAdmin()
  const supabase = await createClient()
  await supabase.from('students').update({ is_active: isActive }).eq('id', id)
  revalidate()
}

export async function deleteStudent(id: string): Promise<FormResult> {
  await requireAdmin()
  const supabase = await createClient()
  const { error } = await supabase.from('students').delete().eq('id', id)
  if (error) return { error: '지우지 못했습니다. PBS 기록이 남아 있으면 대신 "사용 중지"를 쓰세요.' }
  revalidate()
  return { ok: true }
}
