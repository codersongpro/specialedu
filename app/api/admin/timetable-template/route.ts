import { buildTimetableTemplate } from '@/lib/import/timetable-xlsx'
import { createClient, isAdmin, getSessionContext } from '@/lib/supabase/server'

/**
 * 시간표 업로드 양식(.xlsx) 내려받기.
 *
 * 이 학교에 등록된 학급 이름을 "안내" 시트에 넣어 만든다 — 학급을 하나도
 * 안 만든 상태로 받으면 빈 안내만 나오지만, 업로드 자체는 여전히 된다
 * (그 경우 관리자가 학급 이름을 직접 정확히 입력해야 함).
 */
export async function GET() {
  const session = await getSessionContext()
  if (!session) return new Response('Unauthorized', { status: 401 })
  if (!isAdmin(session.profile)) return new Response('Forbidden', { status: 403 })

  const supabase = await createClient()
  const { data: classes } = await supabase
    .from('classes')
    .select('name')
    .eq('school_id', session.school.id)
    .order('grade')

  const buffer = await buildTimetableTemplate((classes ?? []).map((c) => c.name))

  return new Response(new Uint8Array(buffer), {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename*=UTF-8''${encodeURIComponent('시간표_업로드_양식.xlsx')}`,
      'Cache-Control': 'no-store',
    },
  })
}
