import { headers } from 'next/headers'
import { Badge, Button, Card, PageHeader } from '@/components/ui'
import { requireSession } from '@/lib/supabase/server'
import { removePersonalKey, removePersonalYoutubeKey, rotateCalendarToken } from './actions'
import { KeyForm } from './key-form'
import { YoutubeKeyForm } from './youtube-key-form'

export default async function SettingsPage() {
  const session = await requireSession()
  const headerList = await headers()
  const host = headerList.get('host') ?? 'localhost:3000'
  const protocol = host.startsWith('localhost') ? 'http' : 'https'
  const calendarUrl = `${protocol}://${host}/api/calendar/${session.profile.calendar_token}.ics`

  return (
    <>
      <PageHeader title="내 설정" />

      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="p-5">
          <h2 className="text-sm font-semibold">내 정보</h2>
          <dl className="mt-3 space-y-2 text-sm">
            <div className="flex gap-3">
              <dt className="w-20 shrink-0 text-ink-soft">이름</dt>
              <dd>{session.profile.name}</dd>
            </div>
            <div className="flex gap-3">
              <dt className="w-20 shrink-0 text-ink-soft">학교</dt>
              <dd>{session.school.name}</dd>
            </div>
            <div className="flex gap-3">
              <dt className="w-20 shrink-0 text-ink-soft">출근 요일</dt>
              <dd>
                {(session.profile.work_days ?? [])
                  .map((d) => ['', '월', '화', '수', '목', '금', '토', '일'][d])
                  .join(' ')}
              </dd>
            </div>
          </dl>
          <p className="mt-3 text-xs text-ink-soft">
            정보를 고치려면 교무실에 요청하세요.
          </p>
        </Card>

        <Card className="p-5">
          <h2 className="text-sm font-semibold">캘린더 구독</h2>
          <p className="mt-1.5 text-sm text-ink-soft">
            아래 주소를 구글 캘린더에 추가하면 학사일정이 자동으로 들어옵니다.
          </p>
          <code className="mt-3 block break-all rounded-lg bg-canvas px-3 py-2 text-xs">
            {calendarUrl}
          </code>
          <p className="mt-2 text-xs text-ink-soft">
            이 주소를 아는 사람은 로그인 없이 일정을 볼 수 있습니다. 새어 나갔다면 갈아 끼우세요.
          </p>
          <form action={rotateCalendarToken} className="mt-3">
            <Button variant="secondary" type="submit">
              주소 바꾸기
            </Button>
          </form>
        </Card>

        <Card className="p-5 lg:col-span-2">
          <h2 className="text-sm font-semibold">Gemini API 키</h2>
          <p className="mt-1.5 text-sm leading-relaxed text-ink-soft">
            수업 도구함에서 쓰는 키입니다. 학교 공용 키가 등록돼 있으면 따로 넣지 않아도 됩니다.
            다만 무료 키는 하루 사용량이 정해져 있어, 자주 쓰신다면 개인 키를 넣는 편이 낫습니다.
            Google AI Studio에서 무료로 발급받을 수 있습니다.
          </p>

          <SchoolKeyStatus hint={session.school.gemini_key_hint} label="학교 공용 Gemini 키" />

          {session.profile.gemini_key_hint ? (
            <div className="mt-4 flex items-center gap-3">
              <code className="rounded-lg bg-canvas px-3 py-1.5 text-sm">
                {session.profile.gemini_key_hint}
              </code>
              <form action={removePersonalKey}>
                <Button variant="secondary" type="submit">
                  지우기
                </Button>
              </form>
            </div>
          ) : (
            <div className="mt-4 max-w-md">
              <KeyForm />
            </div>
          )}

          <p className="mt-4 rounded-lg bg-warn-soft px-3 py-2 text-xs leading-relaxed text-warn">
            무료 키는 전송한 내용이 Google의 모델 학습에 쓰일 수 있습니다. 그래서 도구함에서는
            학생 이름·연락처를 자동으로 가려서 보내고, 보내기 전에 무엇이 나가는지 보여 줍니다.
          </p>
        </Card>

        <Card className="p-5 lg:col-span-2">
          <h2 className="text-sm font-semibold">유튜브 검색 키</h2>
          <p className="mt-1.5 text-sm leading-relaxed text-ink-soft">
            &ldquo;수업 자료 찾기&rdquo;에서 쓰는 키입니다. 학교 공용 키가 등록돼 있으면 따로
            넣지 않아도 됩니다. 이 키는 오직 이 계정에서만 쓰이고 다른 학교와는 공유되지
            않습니다. Google Cloud Console에서 YouTube Data API v3 키를 무료로 발급받을 수
            있습니다.
          </p>

          <SchoolKeyStatus hint={session.school.youtube_key_hint} label="학교 공용 유튜브 키" />

          {session.profile.youtube_key_hint ? (
            <div className="mt-4 flex items-center gap-3">
              <code className="rounded-lg bg-canvas px-3 py-1.5 text-sm">
                {session.profile.youtube_key_hint}
              </code>
              <form action={removePersonalYoutubeKey}>
                <Button variant="secondary" type="submit">
                  지우기
                </Button>
              </form>
            </div>
          ) : (
            <div className="mt-4 max-w-md">
              <YoutubeKeyForm />
            </div>
          )}
        </Card>
      </div>
    </>
  )
}

/**
 * 학교 공용 키가 등록돼 있는지 모든 교직원이 볼 수 있게 한다.
 *
 * 예전엔 개인 키 힌트만 보여줘서, 학교 공용 키가 등록됐는지는 수업
 * 도구함에서 "등록된 키가 없습니다" 오류를 받아 봐야 알 수 있었다.
 * 값이 아니라 뒷 4자리 힌트만 보여주므로 노출 범위가 넓어지지 않는다
 * (schools_select RLS가 이미 같은 학교로 좁혀 준 값이다).
 */
function SchoolKeyStatus({ hint, label }: { hint: string | null; label: string }) {
  return (
    <div className="mt-3 flex items-center gap-2 text-sm">
      <span className="text-ink-soft">{label}</span>
      {hint ? (
        <>
          <Badge tone="ok">등록됨</Badge>
          <code className="text-xs text-ink-soft">{hint}</code>
        </>
      ) : (
        <Badge tone="warn">아직 등록되지 않았습니다 — 관리자에게 요청하세요</Badge>
      )}
    </div>
  )
}
