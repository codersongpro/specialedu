-- =============================================================================
-- 0019_staff_position — 교직원 등록 시 직급 입력
--
-- role(admin/manager/teacher/part_time/staff)은 권한 등급이고, employment는
-- 근무 형태다. 둘 다 "교장"·"교감"·"행정실장" 같은 실제 직급명을 담지
-- 못한다(예: 교감은 대개 role='admin'이지만 화면에는 "교감"이라고 보여줘야
-- 함). 그래서 표시용 자유 텍스트 position 컬럼을 별도로 둔다 — 학교마다
-- 직제 명칭이 달라 enum으로 고정하면 늘 예외가 생긴다.
-- =============================================================================

alter table public.profiles add column position text;
alter table public.invitations add column position text;

-- guard_profiles_update()(0014_rls_hardening.sql)에 position도 관리자만
-- 바꿀 수 있는 열로 추가한다 — 역할·근무형태·부서와 같은 조직 정보라서다.
create or replace function public.guard_profiles_update()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.school_id is distinct from old.school_id then
    raise exception 'school_id는 바꿀 수 없습니다';
  end if;

  if public.is_admin() then
    return new;
  end if;

  if new.role is distinct from old.role
     or new.is_active is distinct from old.is_active
     or new.employment is distinct from old.employment
     or new.department_id is distinct from old.department_id
     or new.work_days is distinct from old.work_days
     or new.position is distinct from old.position
  then
    raise exception '이 항목은 관리자만 바꿀 수 있습니다';
  end if;

  return new;
end;
$$;
