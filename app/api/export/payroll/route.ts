import { format } from 'date-fns'
import { csvResponse, toCsv } from '@/lib/export/csv'
import { toHHMM } from '@/lib/scheduling/time'
import { AUDIT_ACTIONS, writeAudit } from '@/lib/security/audit'
import { createClient, isAdmin, getSessionContext } from '@/lib/supabase/server'

const REASON_LABEL: Record<string, string> = {
  business_trip: '출장',
  sick: '병가',
  annual: '연가',
  training: '연수',
  official: '공가',
  other: '기타',
}

export async function GET(request: Request) {
  const session = await getSessionContext()
  if (!session) return new Response('Unauthorized', { status: 401 })
  if (!isAdmin(session.profile)) return new Response('Forbidden', { status: 403 })

  const month = new URL(request.url).searchParams.get('month') ?? ''
  if (!/^\d{4}-\d{2}$/.test(month)) {
    return new Response('month 형식은 YYYY-MM 이어야 합니다', { status: 400 })
  }

  const from = `${month}-01`
  const to = format(new Date(Number(month.slice(0, 4)), Number(month.slice(5, 7)), 0), 'yyyy-MM-dd')

  const supabase = await createClient()
  const [{ data: rows }, { data: profiles }, { data: classes }, { data: subjects }, { data: absences }] =
    await Promise.all([
      supabase
        .from('substitution_assignments')
        .select('*')
        .eq('is_paid', true)
        .gte('assign_date', from)
        .lte('assign_date', to)
        .order('assign_date'),
      supabase.from('profiles').select('id, name').eq('school_id', session.school.id),
      supabase.from('classes').select('id, name').eq('school_id', session.school.id),
      supabase.from('subjects').select('id, name').eq('school_id', session.school.id),
      supabase.from('absences').select('id, teacher_id, reason').eq('school_id', session.school.id),
    ])

  const nameById = new Map((profiles ?? []).map((p) => [p.id, p.name]))
  const classById = new Map((classes ?? []).map((c) => [c.id, c.name]))
  const subjectById = new Map((subjects ?? []).map((s) => [s.id, s.name]))
  const absenceById = new Map((absences ?? []).map((a) => [a.id, a]))

  const csv = toCsv(
    ['날짜', '교시', '시작', '끝', '보강 교사', '학급', '교과', '결과 교사', '사유'],
    (rows ?? []).map((row) => {
      const absence = absenceById.get(row.absence_id)
      return [
        row.assign_date,
        row.period_no,
        toHHMM(row.starts_min),
        toHHMM(row.ends_min),
        row.assigned_teacher_id ? (nameById.get(row.assigned_teacher_id) ?? '') : '',
        row.class_id ? (classById.get(row.class_id) ?? '') : '',
        row.subject_id ? (subjectById.get(row.subject_id) ?? '') : '',
        absence ? (nameById.get(absence.teacher_id) ?? '') : '',
        absence ? (REASON_LABEL[absence.reason] ?? '') : '',
      ]
    }),
  )

  await writeAudit({
    schoolId: session.school.id,
    actorId: session.userId,
    actorName: session.profile.name,
    action: AUDIT_ACTIONS.exportDownload,
    meta: { kind: 'payroll', month, rows: rows?.length ?? 0 },
  })

  return csvResponse(`결보강_정산_${month}.csv`, csv)
}
