import 'server-only'

import { headers } from 'next/headers'
import { createAdminClient } from '@/lib/supabase/admin'

/**
 * 감사로그.
 *
 * service role 로 쓴다 — 교직원이 자기 조회 기록을 지울 수 있으면
 * 감사로그를 남기는 의미가 없다. 정책상 읽기는 관리자만 가능하다.
 *
 * meta 에 개인정보 원문을 넣지 말 것. "무엇을 봤는지"는 남기되
 * "무엇이 적혀 있었는지"는 남기지 않는다.
 */

export interface AuditEntry {
  // 플랫폼 최고관리자의 행동은 특정 학교에 속하지 않을 수 있어 null 을 허용한다.
  schoolId: string | null
  actorId: string | null
  actorName?: string | null
  action: string
  targetTable?: string
  targetId?: string
  meta?: Record<string, unknown>
}

export async function writeAudit(entry: AuditEntry): Promise<void> {
  try {
    const headerList = await headers()
    const admin = createAdminClient()

    await admin.from('audit_logs').insert({
      school_id: entry.schoolId,
      actor_id: entry.actorId,
      actor_name: entry.actorName ?? null,
      action: entry.action,
      target_table: entry.targetTable ?? null,
      target_id: entry.targetId ?? null,
      meta: entry.meta ?? null,
      ip: clientIp(headerList),
      user_agent: headerList.get('user-agent')?.slice(0, 500) ?? null,
    })
  } catch (error) {
    // 감사로그 실패가 업무를 막으면 안 된다. 다만 조용히 삼키지는 않는다.
    console.error('[audit] 기록 실패', error)
  }
}

function clientIp(headerList: Headers): string | null {
  const forwarded = headerList.get('x-forwarded-for')
  if (forwarded) {
    const first = forwarded.split(',')[0]?.trim()
    if (first) return first
  }
  return headerList.get('x-real-ip')
}

export const AUDIT_ACTIONS = {
  login: 'auth.login',
  inviteAccept: 'auth.invite_accept',
  sensitiveZoneEnter: 'zone.sensitive_enter',
  reservationCreate: 'reservation.create',
  reservationCancel: 'reservation.cancel',
  reservationApprove: 'reservation.approve',
  absenceCreate: 'absence.create',
  substitutionAssign: 'substitution.assign',
  eventCreate: 'event.create',
  timetableImport: 'timetable.import',
  budgetLineCreate: 'budget_line.create',
  budgetExpenseCreate: 'budget_expense.create',
  budgetExpenseApprove: 'budget_expense.approve',
  budgetExpenseReject: 'budget_expense.reject',
  pbsRecordCreate: 'pbs_record.create',
  pbsRecordView: 'pbs_record.view',
  safetyProtocolCreate: 'safety_protocol.create',
  safetyProtocolView: 'safety_protocol.view',
  iepGoalCreate: 'iep_goal.create',
  iepGoalView: 'iep_goal.view',
  iepProgressCreate: 'iep_progress.create',
  aiRequest: 'ai.request',
  exportDownload: 'export.download',
  platformLogin: 'platform.login',
  platformSchoolCreate: 'platform.school_create',
  platformAdminInvite: 'platform.admin_invite',
} as const
