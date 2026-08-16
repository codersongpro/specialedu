'use client'

import { useState } from 'react'

interface SeedSummary {
  schoolName: string
  staff: number
  classes: number
  rooms: number
  slots: number
  reservations: number
  events: number
  students: number
  safetyProtocols: number
  accounts: Array<{ email: string; password: string; note: string }>
}

/**
 * 데모 데이터 만들기 버튼.
 *
 * curl 을 치지 않고 브라우저에서 끝낼 수 있게 둔 화면이다.
 * SEED_SECRET 이 설정돼 있어야만 서버가 받아 준다.
 */
export function SeedPanel() {
  const [secret, setSecret] = useState('')
  const [state, setState] = useState<'idle' | 'running' | 'done' | 'error'>('idle')
  const [message, setMessage] = useState('')
  const [detail, setDetail] = useState('')
  const [log, setLog] = useState<string[]>([])
  const [summary, setSummary] = useState<SeedSummary | null>(null)

  async function run() {
    setState('running')
    setMessage('')
    setDetail('')
    setLog([])
    setSummary(null)

    try {
      const response = await fetch('/api/demo/seed', {
        method: 'POST',
        headers: { Authorization: `Bearer ${secret}` },
      })
      const body = await response.json()

      if (!response.ok) {
        setState('error')
        setMessage(body.error ?? '실패했습니다')
        // 서버가 실제 원인(Postgres 에러 메시지 등)을 detail 에 담아 보낸다.
        // 이게 없으면 "스키마를 확인하세요" 같은 일반 안내문만 보이고
        // 진짜 원인을 알 수가 없다.
        setDetail(typeof body.detail === 'string' ? body.detail : '')
        setLog(Array.isArray(body.log) ? body.log : [])
        return
      }

      setState('done')
      setSummary(body.summary)
    } catch {
      setState('error')
      setMessage('서버에 연결하지 못했습니다')
    }
  }

  if (state === 'done' && summary) {
    return (
      <div className="mt-10 rounded-xl border border-line bg-surface p-5">
        <p className="text-sm font-semibold">{summary.schoolName}을 만들었습니다</p>
        <p className="mt-1 text-xs text-ink-soft">
          교직원 {summary.staff}명 · 학급 {summary.classes}개 · 특별실 {summary.rooms}개 · 시간표{' '}
          {summary.slots}칸 · 예약 {summary.reservations}건 · 일정 {summary.events}건 · 학생{' '}
          {summary.students}명 · 안전 프로토콜 {summary.safetyProtocols}건
        </p>

        <ul className="mt-4 space-y-1">
          {summary.accounts.map((account) => (
            <li key={account.email} className="text-xs">
              <span className="font-medium">{account.note}</span>
              <span className="ml-2 text-ink-soft">
                {account.email} / {account.password}
              </span>
            </li>
          ))}
        </ul>

        <a
          href="/login"
          className="mt-5 inline-flex h-11 items-center rounded-lg bg-brand px-4 text-base font-medium text-white"
        >
          로그인 화면으로
        </a>
        <p className="mt-3 text-xs text-ink-soft">
          로그인 화면에 역할별 둘러보기 버튼이 생겼습니다. 눌러서 바로 들어가 보세요.
          다 보셨으면 SEED_SECRET 환경변수는 지우는 편이 안전합니다.
        </p>
      </div>
    )
  }

  return (
    <div className="mt-10 rounded-xl border border-line bg-surface p-5">
      <p className="text-sm font-semibold">데모 데이터 만들기 (선택)</p>
      <p className="mt-1 text-xs leading-relaxed text-ink-soft">
        위 1~3단계를 마쳤다면, 가상 학교 하나를 통째로 만들어 둘러볼 수 있습니다.
        환경변수 <code>SEED_SECRET</code> 에 넣은 값을 여기에 적으세요.
      </p>

      <div className="mt-3 flex gap-2">
        <input
          type="password"
          value={secret}
          onChange={(e) => setSecret(e.target.value)}
          placeholder="SEED_SECRET"
          className="h-11 flex-1 rounded-lg border border-line px-3.5 text-base outline-none focus:border-brand"
        />
        <button
          type="button"
          onClick={run}
          disabled={!secret || state === 'running'}
          className="h-11 shrink-0 rounded-lg bg-brand px-4 text-base font-medium text-white disabled:opacity-50"
        >
          {state === 'running' ? '만드는 중' : '만들기'}
        </button>
      </div>

      {state === 'running' ? (
        <p className="mt-2 text-xs text-ink-soft">
          계정 25개를 만드느라 1분쯤 걸립니다. 창을 닫지 마세요.
        </p>
      ) : null}

      {state === 'error' ? (
        <div role="alert" className="mt-2 space-y-2">
          <p className="rounded-lg bg-danger-soft px-3 py-2 text-xs text-danger">{message}</p>
          {detail ? (
            <div className="rounded-lg bg-canvas p-3">
              <p className="text-[11px] font-semibold text-ink-soft">실제 원인 (개발자용)</p>
              <code className="mt-1 block break-all text-[11px] text-ink-soft">{detail}</code>
            </div>
          ) : null}
          {log.length > 0 ? (
            <div className="rounded-lg bg-canvas p-3">
              <p className="text-[11px] font-semibold text-ink-soft">
                여기까지는 됐습니다 ({log.length}줄)
              </p>
              <pre className="mt-1 whitespace-pre-wrap break-all text-[11px] text-ink-soft">
                {log.join('\n')}
              </pre>
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  )
}
