import { formatSpan, overlaps, type TimeSpan } from '@/lib/scheduling/time'

/**
 * 보조인력 배치 점검.
 *
 * 학급이 지원을 필요로 하는 시간과 보조인력의 근무 가능 시간을 맞대어
 * **공백(아무도 안 들어감)**과 **중복(한 사람이 두 곳에 걸림)**을 찾는다.
 *
 * 왜 막지 않고 경고만 하는가: 이 기능의 목적이 "지금 배치가 어디가
 * 비었는지 보여주는 것"이라, DB나 저장 단계에서 중복을 거부해 버리면
 * 보여줄 상태 자체가 만들어지지 않는다. 그래서 판정을 여기 순수 함수로
 * 두고 화면이 경고로 표시한다 (supabase/migrations/0016_support_staffing.sql
 * 맨 위에 같은 설명이 있다).
 *
 * 비교는 반드시 분(minute) 단위로 한다. 과정마다 시정이 달라 초등 3교시와
 * 고등 3교시는 실제로 다른 시각이므로, 교시 번호로 겹침을 판정하면
 * 놓친다 (lib/scheduling/time.ts 참고).
 */

export interface SupportNeed extends TimeSpan {
  id: string
  classId: string
  className: string
  dayOfWeek: number
  periodNo: number
}

export interface AvailabilityWindow extends TimeSpan {
  dayOfWeek: number
}

export interface SupportStaff {
  profileId: string
  name: string
  /** 요일별 근무 가능 구간. 비어 있으면 근무 시간이 등록되지 않은 것이다. */
  availability: AvailabilityWindow[]
}

export interface SupportAssignment {
  needId: string
  profileId: string
}

export type CoverageWarningKind =
  /** 공백 — 아무도 맡지 않았다 */
  | 'uncovered'
  /** 공백 — 맡았지만 그 사람 근무시간이 아니다 */
  | 'outside_hours'
  /** 중복 — 같은 사람이 겹치는 시간에 두 곳을 맡았다 */
  | 'double_booked'

export interface CoverageWarning {
  kind: CoverageWarningKind
  needId: string
  /** 화면에 그대로 쓰는 한국어 설명 */
  message: string
  profileId?: string
  /** 중복일 때 맞물린 상대 */
  conflictingNeedId?: string
}

export interface CoverageResult {
  warnings: CoverageWarning[]
  /** 경고 없이 제대로 채워진 지원 시간 수 */
  coveredCount: number
}

function coversWindow(staff: SupportStaff, need: SupportNeed): boolean {
  return staff.availability.some(
    (window) =>
      window.dayOfWeek === need.dayOfWeek &&
      window.startsMin <= need.startsMin &&
      need.endsMin <= window.endsMin,
  )
}

export function checkCoverage(
  needs: readonly SupportNeed[],
  staff: readonly SupportStaff[],
  assignments: readonly SupportAssignment[],
): CoverageResult {
  const warnings: CoverageWarning[] = []
  const staffById = new Map(staff.map((s) => [s.profileId, s]))
  const assignedTo = new Map(assignments.map((a) => [a.needId, a.profileId]))
  const needById = new Map(needs.map((n) => [n.id, n]))

  /** 경고가 하나라도 붙은 지원 시간 — 마지막에 정상 건수를 세는 데 쓴다 */
  const flagged = new Set<string>()
  const flag = (warning: CoverageWarning) => {
    warnings.push(warning)
    flagged.add(warning.needId)
  }

  for (const need of needs) {
    const profileId = assignedTo.get(need.id)
    const where = `${need.className} ${need.periodNo}교시(${formatSpan(need)})`

    if (!profileId) {
      flag({
        kind: 'uncovered',
        needId: need.id,
        message: `${where} — 맡은 사람이 없습니다`,
      })
      continue
    }

    const person = staffById.get(profileId)
    if (!person) {
      // 배치된 사람이 명단에서 사라진 경우(퇴직·비활성). 공백과 같게 다룬다.
      flag({
        kind: 'uncovered',
        needId: need.id,
        profileId,
        message: `${where} — 배치된 사람을 찾을 수 없습니다`,
      })
      continue
    }

    if (!coversWindow(person, need)) {
      flag({
        kind: 'outside_hours',
        needId: need.id,
        profileId,
        message: `${where} — ${person.name} 님의 근무 시간이 아닙니다`,
      })
    }
  }

  // --- 중복 배치 -------------------------------------------------------------
  // 같은 사람이 맡은 지원 시간끼리 짝지어 비교한다. 한 쌍당 경고 하나만
  // 남기려고 i < j 로만 본다.
  const byPerson = new Map<string, SupportNeed[]>()
  for (const assignment of assignments) {
    const need = needById.get(assignment.needId)
    if (!need) continue
    const list = byPerson.get(assignment.profileId) ?? []
    list.push(need)
    byPerson.set(assignment.profileId, list)
  }

  for (const [profileId, list] of byPerson) {
    const name = staffById.get(profileId)?.name ?? '배치된 사람'
    for (let i = 0; i < list.length; i += 1) {
      for (let j = i + 1; j < list.length; j += 1) {
        const a = list[i]!
        const b = list[j]!
        if (a.dayOfWeek !== b.dayOfWeek) continue
        if (!overlaps(a, b)) continue

        flag({
          kind: 'double_booked',
          needId: a.id,
          profileId,
          conflictingNeedId: b.id,
          message: `${name} 님이 같은 시간에 ${a.className}과 ${b.className} 두 곳에 배치됐습니다 (${formatSpan(a)})`,
        })
        flagged.add(b.id)
      }
    }
  }

  return { warnings, coveredCount: needs.filter((n) => !flagged.has(n.id)).length }
}
