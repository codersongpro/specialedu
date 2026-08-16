import type { IepAchievementLevel, IepArea, IepGoalStatus } from '@/lib/supabase/database.types'

export const AREA_LABEL: Record<IepArea, string> = {
  self_care: '자조',
  communication: '의사소통',
  academic: '학습',
  social: '사회성',
  motor: '운동',
  other: '기타',
}

export const STATUS_LABEL: Record<IepGoalStatus, string> = {
  active: '진행중',
  achieved: '달성',
  discontinued: '중단',
}

export const STATUS_TONE: Record<IepGoalStatus, 'brand' | 'ok' | 'neutral'> = {
  active: 'brand',
  achieved: 'ok',
  discontinued: 'neutral',
}

export const LEVEL_LABEL: Record<IepAchievementLevel, string> = {
  independent: '독립수행',
  partial_help: '부분도움',
  full_help: '전체도움',
  not_yet: '미수행',
}

export const LEVEL_TONE: Record<IepAchievementLevel, 'ok' | 'warn' | 'danger' | 'neutral'> = {
  independent: 'ok',
  partial_help: 'warn',
  full_help: 'danger',
  not_yet: 'neutral',
}

export const LEVEL_ORDER: IepAchievementLevel[] = ['independent', 'partial_help', 'full_help', 'not_yet']
