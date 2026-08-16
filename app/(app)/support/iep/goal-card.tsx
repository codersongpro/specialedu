'use client'

import { useState, useTransition } from 'react'
import { Badge, Button, inputClass } from '@/components/ui'
import { cn } from '@/lib/cn'
import type { ProgressTrend } from '@/lib/iep/progress'
import type { IepAchievementLevel, IepArea, IepGoalStatus } from '@/lib/supabase/database.types'
import { deleteGoal, deleteProgress, recordProgress, saveProgressNote, updateGoalStatus } from './actions'
import { AREA_LABEL, LEVEL_LABEL, LEVEL_ORDER, LEVEL_TONE, STATUS_LABEL, STATUS_TONE } from './labels'

export interface ProgressItem {
  id: string
  occurredOn: string
  level: IepAchievementLevel
  note: string | null
  recordedByName: string
  canDelete: boolean
}

export interface GoalItem {
  id: string
  studentId: string
  area: IepArea
  title: string
  termLabel: string
  status: IepGoalStatus
  createdByName: string
  canEdit: boolean
  progress: ProgressItem[]
  trend: ProgressTrend
}

const TREND_LABEL: Record<ProgressTrend, string> = {
  up: '▲ 좋아지는 중',
  down: '▼ 주춤',
  flat: '▬ 제자리',
  unknown: '',
}
const TREND_TONE: Record<ProgressTrend, 'ok' | 'warn' | 'neutral'> = {
  up: 'ok',
  down: 'warn',
  flat: 'neutral',
  unknown: 'neutral',
}

export function GoalCard({ goal }: { goal: GoalItem }) {
  const [statusPending, startStatusTransition] = useTransition()
  const [status, setStatus] = useState(goal.status)
  const [removed, setRemoved] = useState(false)
  const [deletePending, startDeleteTransition] = useTransition()

  const [recordPending, startRecordTransition] = useTransition()
  const [lastProgressId, setLastProgressId] = useState<string | null>(null)
  const [noteOpen, setNoteOpen] = useState(false)
  const [note, setNote] = useState('')
  const [notePending, startNoteTransition] = useTransition()
  const [noteSaved, setNoteSaved] = useState(false)
  const [message, setMessage] = useState<string | null>(null)

  const [historyOpen, setHistoryOpen] = useState(false)

  if (removed) return null

  function tapLevel(level: IepAchievementLevel) {
    setMessage(null)
    setNoteOpen(false)
    setNoteSaved(false)
    setNote('')
    startRecordTransition(async () => {
      const result = await recordProgress({ goalId: goal.id, level })
      if (result.error) {
        setMessage(result.error)
        return
      }
      setLastProgressId(result.id ?? null)
      setMessage(`기록했습니다 — ${LEVEL_LABEL[level]}`)
      setHistoryOpen(true)
    })
  }

  function saveNote() {
    if (!lastProgressId) return
    startNoteTransition(async () => {
      const result = await saveProgressNote(lastProgressId, note)
      if (!result.error) setNoteSaved(true)
    })
  }

  return (
    <li className="rounded-[14px] border border-line p-4">
      <div className="flex flex-wrap items-center gap-2">
        <Badge tone="brand">{AREA_LABEL[goal.area]}</Badge>
        <span className="text-[15px] font-medium">{goal.title}</span>
        {goal.trend !== 'unknown' ? (
          <Badge tone={TREND_TONE[goal.trend]}>{TREND_LABEL[goal.trend]}</Badge>
        ) : null}
      </div>
      <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[13px] text-ink-soft">
        <span className="whitespace-nowrap">{goal.termLabel}</span>
        <span className="whitespace-nowrap">작성: {goal.createdByName}</span>
      </div>

      <div className="mt-2 flex flex-wrap items-center gap-2">
        {goal.canEdit ? (
          <select
            value={status}
            disabled={statusPending}
            onChange={(e) => {
              const next = e.target.value as IepGoalStatus
              setStatus(next)
              startStatusTransition(async () => {
                await updateGoalStatus(goal.id, next)
              })
            }}
            className="h-8 rounded-lg border border-line bg-surface px-2 text-[13px]"
          >
            {(Object.keys(STATUS_LABEL) as IepGoalStatus[]).map((s) => (
              <option key={s} value={s}>
                {STATUS_LABEL[s]}
              </option>
            ))}
          </select>
        ) : (
          <Badge tone={STATUS_TONE[status]}>{STATUS_LABEL[status]}</Badge>
        )}
        {goal.canEdit ? (
          <button
            type="button"
            disabled={deletePending}
            onClick={() =>
              startDeleteTransition(async () => {
                const result = await deleteGoal(goal.id)
                if (result.ok) setRemoved(true)
              })
            }
            className="text-[12.5px] text-ink-soft underline hover:text-danger"
          >
            목표 삭제
          </button>
        ) : null}
      </div>

      <p className="mt-3 text-[13px] font-semibold text-ink-soft">진도 기록 — 누르면 바로 기록됩니다</p>
      <div className="mt-1.5 flex flex-wrap gap-1.5">
        {LEVEL_ORDER.map((level) => (
          <button
            key={level}
            type="button"
            disabled={recordPending}
            onClick={() => tapLevel(level)}
            className="rounded-lg border border-line bg-surface px-3 py-1.5 text-[13.5px] font-medium transition-colors hover:border-brand hover:bg-brand-soft hover:text-brand disabled:opacity-50"
          >
            {LEVEL_LABEL[level]}
          </button>
        ))}
      </div>

      {message ? <p className="mt-2 text-[13px] text-ok">{message}</p> : null}

      {lastProgressId ? (
        <div className="mt-2">
          {!noteOpen ? (
            <button type="button" onClick={() => setNoteOpen(true)} className="text-[13px] text-brand underline">
              메모 붙이기
            </button>
          ) : (
            <div className="flex flex-wrap items-center gap-2">
              <input
                value={note}
                onChange={(e) => setNote(e.target.value)}
                maxLength={500}
                placeholder="짧은 메모 (선택)"
                className={cn(inputClass, 'h-8 max-w-xs text-[13.5px]')}
              />
              <Button variant="secondary" className="h-8 px-3 text-[13px]" onClick={saveNote} disabled={notePending}>
                {notePending ? '저장 중' : '저장'}
              </Button>
              {noteSaved ? <span className="text-[12.5px] text-ok">저장했습니다</span> : null}
            </div>
          )}
        </div>
      ) : null}

      {goal.progress.length > 0 ? (
        <div className="mt-3 border-t border-line pt-2">
          <button
            type="button"
            onClick={() => setHistoryOpen((v) => !v)}
            className="text-[13px] text-brand underline"
          >
            {historyOpen ? '기록 접기' : `최근 기록 보기 (${goal.progress.length}건)`}
          </button>
          {historyOpen ? (
            <ul className="mt-2 space-y-2">
              {goal.progress.map((p) => (
                <ProgressRow key={p.id} progress={p} />
              ))}
            </ul>
          ) : null}
        </div>
      ) : null}
    </li>
  )
}

function ProgressRow({ progress }: { progress: ProgressItem }) {
  const [removed, setRemoved] = useState(false)
  const [pending, startTransition] = useTransition()

  if (removed) return null

  return (
    <li className="rounded-lg bg-canvas px-3 py-2">
      <div className="flex flex-wrap items-center gap-2">
        <span className="whitespace-nowrap text-[13px] tabular text-ink-soft">
          {new Date(progress.occurredOn).toLocaleDateString('ko-KR', { month: 'numeric', day: 'numeric' })}
        </span>
        <Badge tone={LEVEL_TONE[progress.level]}>{LEVEL_LABEL[progress.level]}</Badge>
        <span className="whitespace-nowrap text-[12.5px] text-ink-soft">기록: {progress.recordedByName}</span>
        {progress.canDelete ? (
          <button
            type="button"
            disabled={pending}
            onClick={() =>
              startTransition(async () => {
                const result = await deleteProgress(progress.id)
                if (result.ok) setRemoved(true)
              })
            }
            className="ml-auto text-[12.5px] text-ink-soft underline hover:text-danger"
          >
            삭제
          </button>
        ) : null}
      </div>
      {progress.note ? <p className="mt-1 text-[13px] leading-relaxed">{progress.note}</p> : null}
    </li>
  )
}
