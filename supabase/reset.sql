-- =============================================================================
-- 초기화 — schema.sql 을 다시 처음부터 실행하기 전에 먼저 돌린다
--
-- SQL Editor에 schema.sql 을 통째로 붙여넣다가 중간에 끊기면(네트워크 문제,
-- 잘못 붙여넣기 등) 일부 타입·테이블만 만들어진 채로 남는다. 그 상태에서
-- 다시 schema.sql 을 실행하면 "type user_role already exists" 같은 오류가
-- 난다. 이 파일은 우리가 만드는 객체를 전부 지워서 완전히 빈 상태로
-- 되돌린다 — 실 데이터가 있는 학교에서는 절대 실행하면 안 된다.
--
-- 사용법: 이 파일 전체를 SQL Editor에 붙여넣어 실행 → 그 다음 schema.sql
-- 을 처음부터 다시 실행한다.
-- =============================================================================

-- 안전장치: 실제(데모가 아닌) 학교 데이터가 이미 있으면 여기서 멈춘다.
-- 위 경고 문구를 읽지 않고 실 운영 중인 프로젝트에 이 파일을 그대로
-- 붙여넣는 사고를 실제로 겪은 뒤 추가했다 — 로그인 계정(auth.users)은
-- 남지만 그 계정이 속한 학교·프로필이 통째로 사라져 아무도 못 들어가는
-- 상태가 됐었다. 정말 처음부터 다시 만들어야 하면(예: 로컬 개발용
-- 프로젝트를 밀고 싶을 때) 이 블록만 지우고 실행하면 된다.
do $$
begin
  if to_regclass('public.schools') is not null
     and exists (select 1 from public.schools where is_demo = false)
  then
    raise exception '실제 학교 데이터가 있어 멈췄습니다. schema.sql은 프로젝트를 '
      '처음 만들 때만 쓰세요 — 이미 쓰고 있는 프로젝트라면 supabase/migrations/ '
      '아래 새로 추가된 파일 하나만 SQL Editor에서 실행하세요.';
  end if;
end $$;

-- 테이블을 지우면 CASCADE 로 그 테이블에 딸린 트리거·제약·인덱스도 함께
-- 지워진다. 순서는 상관없다 — CASCADE 가 의존관계를 알아서 정리한다.
drop table if exists
  public.ai_usage_logs,
  public.ai_cache,
  public.sensitivity_acks,
  public.audit_logs,
  public.notifications,
  public.safety_protocols,
  public.iep_progress,
  public.iep_goals,
  public.pbs_records,
  public.behavior_categories,
  public.budget_expenses,
  public.budget_lines,
  public.academic_events,
  public.substitution_rules,
  public.substitution_assignments,
  public.absences,
  public.room_reservations,
  public.room_reservation_rules,
  public.room_blackouts,
  public.timetable_slots,
  public.invitations,
  public.students,
  public.rooms,
  public.course_groups,
  public.classes,
  public.subjects,
  public.periods,
  public.terms,
  public.departments,
  public.profiles,
  public.schools
cascade;

-- 테이블에 딸리지 않은 독립 함수들
drop function if exists
  public.touch_updated_at(),
  public.current_school_id(),
  public.current_user_role(),
  public.is_admin(),
  public.same_school(uuid),
  public.period_minutes(uuid, course_level, smallint),
  public.fill_period_minutes(),
  public.purge_expired_audit_logs(),
  public.purge_expired_ai_cache()
cascade;

-- 열거형은 테이블·함수를 다 지운 뒤에 지운다 (컬럼이 참조하고 있으면 못 지움)
drop type if exists
  user_role,
  course_level,
  employment_type,
  booking_kind,
  booking_status,
  absence_reason,
  substitution_status,
  event_scope,
  event_category
cascade;
