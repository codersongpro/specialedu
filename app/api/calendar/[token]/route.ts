import { createAdminClient } from '@/lib/supabase/admin'

/**
 * 개인 캘린더 구독 (ICS).
 *
 * 토큰만으로 접근하므로 로그인 세션이 없다. 그래서 두 가지를 지킨다:
 *   - 학사일정만 내보낸다. 학생 정보나 결보강 상세는 절대 담지 않는다.
 *   - 토큰은 사용자가 언제든 갈아 끼울 수 있다 (내 설정 화면).
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ token: string }> },
) {
  const { token } = await params
  const uuid = token.replace(/\.ics$/, '')

  if (!/^[0-9a-f-]{36}$/i.test(uuid)) {
    return new Response('Not found', { status: 404 })
  }

  const admin = createAdminClient()
  const { data: profile } = await admin
    .from('profiles')
    .select('id, school_id, name')
    .eq('calendar_token', uuid)
    .maybeSingle()

  if (!profile) return new Response('Not found', { status: 404 })

  const { data: school } = await admin
    .from('schools')
    .select('name')
    .eq('id', profile.school_id)
    .maybeSingle()

  const { data: events } = await admin
    .from('academic_events')
    .select('id, title, detail, starts_on, ends_on')
    .eq('school_id', profile.school_id)
    .order('starts_on')
    .limit(500)

  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//specialedu//KO',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    `X-WR-CALNAME:${escapeText(school?.name ?? '학사일정')}`,
    'X-WR-TIMEZONE:Asia/Seoul',
  ]

  for (const event of events ?? []) {
    lines.push(
      'BEGIN:VEVENT',
      `UID:${event.id}@specialedu`,
      `DTSTAMP:${toIcsStamp(new Date())}`,
      `DTSTART;VALUE=DATE:${compact(event.starts_on)}`,
      // ICS 의 종료일은 배타적이라 하루를 더해야 마지막 날이 포함된다
      `DTEND;VALUE=DATE:${compact(addOneDay(event.ends_on))}`,
      `SUMMARY:${escapeText(event.title)}`,
    )
    if (event.detail) lines.push(`DESCRIPTION:${escapeText(event.detail)}`)
    lines.push('END:VEVENT')
  }

  lines.push('END:VCALENDAR')

  return new Response(lines.join('\r\n'), {
    headers: {
      'Content-Type': 'text/calendar; charset=utf-8',
      'Cache-Control': 'private, max-age=600',
      'X-Robots-Tag': 'noindex',
    },
  })
}

function compact(dateString: string): string {
  return dateString.replace(/-/g, '')
}

function addOneDay(dateString: string): string {
  const date = new Date(`${dateString}T00:00:00Z`)
  date.setUTCDate(date.getUTCDate() + 1)
  return date.toISOString().slice(0, 10)
}

function toIcsStamp(date: Date): string {
  return `${date.toISOString().replace(/[-:]/g, '').slice(0, 15)}Z`
}

function escapeText(text: string): string {
  return text.replace(/([,;\\])/g, '\\$1').replace(/\n/g, '\\n')
}
