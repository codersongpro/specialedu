-- =============================================================================
-- 0014_rls_hardening — RLS는 행 단위, 이 파일은 열 단위 방어
--
-- 외부 코드 검토에서 지적받은 문제: Postgres RLS의 USING/WITH CHECK는 "이
-- 행을 만질 수 있는가"만 본다. profiles_update_self 같은 정책은
-- `id = auth.uid()`만 검사해서, 로그인한 일반 교사가 Supabase 클라이언트로
-- 자기 프로필 행에 직접 UPDATE를 보내면 role 을 'admin'으로 바꾸거나
-- school_id 를 다른 학교로 옮기는 것까지 막지 못한다 — 화면(서버 액션)은
-- 그런 필드를 건드리지 않지만, RLS가 최종 방어선이어야 하는데 여기엔
-- 구멍이 있었다. 같은 문제가 특별실 예약·예산 지출·결보강 배정에도 있다
-- (신청자 본인이 자기 행의 status 를 approved 로 직접 바꿀 수 있음).
--
-- 앱 코드 전체를 확인한 결과(이 마이그레이션을 쓰기 전에 grep으로 재확인):
--   - profiles UPDATE 는 settings/actions.ts 의 5곳뿐이고 전부 자기 자신의
--     gemini_key_enc/hint, youtube_key_enc/hint, calendar_token 만 건드림
--   - budget_expenses 를 UPDATE로 고치는 앱 코드가 없음(취소는 DELETE)
--   - substitution_assignments 를 배정된 교사 본인이 UPDATE 하는 앱 코드가
--     없음(수락/거절 화면이 아직 없음)
-- 즉 아래 제한은 지금 동작하는 기능을 하나도 깨지 않는다.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- profiles: 본인이 바꿀 수 있는 열을 제한한다
-- -----------------------------------------------------------------------------
create or replace function public.guard_profiles_update()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- school_id 는 누구도(관리자 포함) UPDATE로 바꿀 수 없다. 학교를
  -- 새로 만들거나 교직원을 초대하는 흐름은 전부 새 행 INSERT이지,
  -- 기존 행의 school_id 를 바꾸는 경우가 없다. 정말 다른 학교로
  -- 옮겨야 하면 서비스 롤(플랫폼 관리자 도구)로 처리한다.
  if new.school_id is distinct from old.school_id then
    raise exception 'school_id는 바꿀 수 없습니다';
  end if;

  if public.is_admin() then
    return new;
  end if;

  -- 관리자가 아니면 권한·소속·근무 관련 열은 그대로 유지돼야 한다.
  -- (개인 Gemini/유튜브 키, 캘린더 토큰 등 나머지 열은 자유롭게 바뀔 수 있음)
  if new.role is distinct from old.role
     or new.is_active is distinct from old.is_active
     or new.employment is distinct from old.employment
     or new.department_id is distinct from old.department_id
     or new.work_days is distinct from old.work_days
  then
    raise exception '이 항목은 관리자만 바꿀 수 있습니다';
  end if;

  return new;
end;
$$;

create trigger profiles_guard_update
  before update on public.profiles
  for each row execute function public.guard_profiles_update();

-- -----------------------------------------------------------------------------
-- room_reservations: 신청자 본인은 취소(cancelled로 바꾸기)만 할 수 있다.
-- 승인·반려는 관리자만(is_admin() 이면 트리거를 통과시킨다).
-- -----------------------------------------------------------------------------
create or replace function public.guard_reservation_update()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if public.is_admin() then
    return new;
  end if;

  -- 신청자 본인: status를 cancelled로 바꾸는 것 말고는 아무 것도 못 바꾼다.
  -- (app/(app)/rooms/actions.ts의 cancelReservation()이 하는 일과 정확히 같다)
  if new.status is distinct from 'cancelled'
     or new.room_id is distinct from old.room_id
     or new.reserved_date is distinct from old.reserved_date
     or new.course is distinct from old.course
     or new.period_no is distinct from old.period_no
     or new.starts_min is distinct from old.starts_min
     or new.ends_min is distinct from old.ends_min
     or new.class_id is distinct from old.class_id
     or new.course_group_id is distinct from old.course_group_id
     or new.requester_id is distinct from old.requester_id
     or new.co_teacher_id is distinct from old.co_teacher_id
     or new.kind is distinct from old.kind
     or new.approved_by is distinct from old.approved_by
     or new.approved_at is distinct from old.approved_at
     or new.reject_reason is distinct from old.reject_reason
  then
    raise exception '본인 예약은 취소만 할 수 있습니다';
  end if;

  return new;
end;
$$;

create trigger reservations_guard_update
  before update on public.room_reservations
  for each row execute function public.guard_reservation_update();

-- -----------------------------------------------------------------------------
-- budget_expenses: 신청자 본인이 UPDATE로 자기 지출을 고치는 화면이 없다
-- (취소는 budget_expenses_delete_owner가 담당하는 DELETE로 처리한다).
-- 즉 budget_expenses_update_owner 정책은 안 쓰이면서 구멍만 열어 두고
-- 있었다 — 지운다. 관리자 승인/반려(budget_expenses_update_admin)는 그대로.
-- -----------------------------------------------------------------------------
drop policy if exists budget_expenses_update_owner on public.budget_expenses;

-- -----------------------------------------------------------------------------
-- substitution_assignments: "배정된 교사가 직접 수락/거절"하는 화면이 아직
-- 없다(assignSubstitute·clearAssignment는 전부 관리자 전용). 정책 설명에
-- "본인 배정은 수락/거절할 수 있다"고 적혀 있었지만 실제로 쓰는 화면이
-- 없는 채로 UPDATE 권한만 열려 있었다 — 지운다. 나중에 자기-응답 기능을
-- 만들 때는 status 전이(assigned→confirmed/declined)만 허용하고 나머지
-- 열(특히 is_paid, score, class_id 등)은 못 바꾸게 하는 좁은 정책이나
-- 트리거로 다시 설계해서 추가해야 한다.
-- -----------------------------------------------------------------------------
drop policy if exists substitution_respond on public.substitution_assignments;
