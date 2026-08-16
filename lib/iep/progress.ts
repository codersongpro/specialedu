import type { IepAchievementLevel } from '@/lib/supabase/database.types'

/**
 * IEP 진도 기록을 목표별로 묶고 최근 추세를 계산하는 순수 함수.
 *
 * 화면(goal-card.tsx)은 이미 최신순으로 정렬된 목록을 받아 쓰지만, 데이터를
 * 만드는 쪽(page.tsx)에서 실수로 정렬을 빼먹어도 항상 올바른 순서로 묶이도록
 * 여기서 직접 날짜 역순 정렬까지 보장한다.
 */

export interface ProgressEntry {
  id: string
  goalId: string
  occurredOn: string // yyyy-mm-dd
  level: IepAchievementLevel
}

/** 목표별로 묶고, 각 목표 안에서는 최신 기록이 앞에 오도록 정렬한다. */
export function groupProgressByGoal<T extends ProgressEntry>(entries: T[]): Map<string, T[]> {
  const map = new Map<string, T[]>()
  for (const entry of entries) {
    const list = map.get(entry.goalId)
    if (list) list.push(entry)
    else map.set(entry.goalId, [entry])
  }
  for (const list of map.values()) {
    list.sort((a, b) => {
      if (a.occurredOn !== b.occurredOn) return a.occurredOn > b.occurredOn ? -1 : 1
      return a.id > b.id ? -1 : a.id < b.id ? 1 : 0
    })
  }
  return map
}

const LEVEL_SCORE: Record<IepAchievementLevel, number> = {
  independent: 3,
  partial_help: 2,
  full_help: 1,
  not_yet: 0,
}

export type ProgressTrend = 'up' | 'down' | 'flat' | 'unknown'

/**
 * 최신 기록과 그 바로 이전 기록을 비교해 좋아지는지/제자리인지/후퇴하는지
 * 판단한다. 기록이 2건 미만이면 판단할 수 없다.
 *
 * entries 는 최신순(내림차순)으로 정렬돼 있다고 가정한다
 * (groupProgressByGoal 이 만든 목록을 그대로 넣으면 된다).
 */
export function progressTrend(entries: Pick<ProgressEntry, 'level'>[]): ProgressTrend {
  if (entries.length < 2) return 'unknown'
  const latest = entries[0]!
  const previous = entries[1]!
  const diff = LEVEL_SCORE[latest.level] - LEVEL_SCORE[previous.level]
  if (diff > 0) return 'up'
  if (diff < 0) return 'down'
  return 'flat'
}
