import { headers } from 'next/headers'
import { Button, Card, PageHeader } from '@/components/ui'
import { requireSession } from '@/lib/supabase/server'
import { removePersonalKey, rotateCalendarToken } from './actions'
import { KeyForm } from './key-form'

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
      </div>
    </>
  )
}
