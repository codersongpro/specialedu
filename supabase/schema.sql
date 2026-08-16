-- =============================================================================
-- 한 번에 붙여넣는 스키마
--
-- Supabase 대시보드 > SQL Editor 에 이 파일을 통째로 붙여넣고 실행하세요.
-- supabase/migrations/ 의 파일을 순서대로 이어 붙인 것입니다.
-- CLI(supabase db push)를 쓰신다면 이 파일은 필요 없습니다.
--
-- 이 파일은 몇 번을 다시 실행해도 안전합니다 — 맨 앞에서 우리가 만드는
-- 객체를 전부 지우고 처음부터 다시 만듭니다 (supabase/reset.sql 내용).
-- 실 데이터가 있는 학교 DB에서는 절대 실행하지 마세요.
--
-- 만들어진 시각: 2026-08-16
-- =============================================================================


-- ─────────────────────────────────────────────────────────────────────────────
-- reset.sql — 처음부터 다시 실행하기 위한 초기화
-- ─────────────────────────────────────────────────────────────────────────────

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

-- 테이블을 지우면 CASCADE 로 그 테이블에 딸린 트리거·제약·인덱스도 함께
-- 지워진다. 순서는 상관없다 — CASCADE 가 의존관계를 알아서 정리한다.
drop table if exists
  public.ai_usage_logs,
  public.ai_cache,
  public.sensitivity_acks,
  public.audit_logs,
  public.notifications,
  public.safety_protocols,
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


-- ─────────────────────────────────────────────────────────────────────────────
-- 0001_core.sql
-- ─────────────────────────────────────────────────────────────────────────────

-- =============================================================================
-- 0001_core — 조직·기준정보 + RLS 기반 함수
--
-- 설계 원칙
--  1. 모든 업무 테이블에 school_id 를 두고 RLS 로 격리한다 (멀티테넌트).
--  2. 학생 테이블에는 실명·생년월일·연락처·진단명 컬럼을 만들지 않는다.
--     가명처리가 이 앱의 가장 강력한 방어선이다.
--  3. 시각 비교는 "교시 번호"가 아니라 자정부터의 분(minute) 으로 한다.
--     초등 3교시와 고등 3교시는 서로 다른 시각이므로 교시 번호로 비교하면
--     충돌을 놓친다.
-- =============================================================================

create extension if not exists "pgcrypto";
create extension if not exists "btree_gist";

-- -----------------------------------------------------------------------------
-- 열거형
-- -----------------------------------------------------------------------------
create type user_role as enum ('admin', 'manager', 'teacher', 'part_time', 'staff');
create type course_level as enum ('elementary', 'middle', 'high', 'vocational');
create type employment_type as enum ('full_time', 'fixed_term', 'part_time', 'assistant');

comment on type course_level is '초등 / 중학(자유학기 포함) / 고등(고교학점제) / 전공과(직업실습)';

-- -----------------------------------------------------------------------------
-- 공통 트리거 — updated_at 자동 갱신
-- -----------------------------------------------------------------------------
create or replace function public.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- -----------------------------------------------------------------------------
-- 학교
-- -----------------------------------------------------------------------------
create table public.schools (
  id           uuid primary key default gen_random_uuid(),
  name         text not null,
  neis_code    text,
  timezone     text not null default 'Asia/Seoul',
  -- 데모 학교는 이 플래그로 구분한다. 실 데이터와 절대 섞이지 않는다.
  is_demo      boolean not null default false,
  -- 변환툴 자유 붙여넣기 개방 여부. 기본은 꺼짐 — 관리자가 위험을 알고 켜야 한다.
  allow_free_text_ai boolean not null default false,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create trigger schools_touch before update on public.schools
  for each row execute function public.touch_updated_at();

-- -----------------------------------------------------------------------------
-- 교직원 프로필 (auth.users 확장)
-- -----------------------------------------------------------------------------
create table public.profiles (
  id              uuid primary key references auth.users(id) on delete cascade,
  school_id       uuid not null references public.schools(id) on delete cascade,
  name            text not null,
  role            user_role not null default 'teacher',
  employment      employment_type not null default 'full_time',
  department_id   uuid,
  -- 시간강사 출근 요일 (1=월 … 5=금). 결보강 후보에서 근무일이 아니면 제외된다.
  work_days       smallint[] not null default '{1,2,3,4,5}',
  -- 개인 Gemini 키 (AES-256-GCM 암호문). 평문은 어디에도 저장하지 않는다.
  gemini_key_enc  text,
  gemini_key_hint text,
  is_active       boolean not null default true,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create index profiles_school_idx on public.profiles(school_id);
create trigger profiles_touch before update on public.profiles
  for each row execute function public.touch_updated_at();

-- -----------------------------------------------------------------------------
-- RLS 기반 함수
--
-- security definer 로 선언해 RLS 를 우회한다. 그렇지 않으면 profiles 의 정책이
-- 다시 이 함수를 호출해 무한 재귀에 빠진다.
-- -----------------------------------------------------------------------------
create or replace function public.current_school_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select school_id from public.profiles where id = auth.uid() and is_active
$$;

create or replace function public.current_user_role()
returns user_role
language sql
stable
security definer
set search_path = public
as $$
  select role from public.profiles where id = auth.uid() and is_active
$$;

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (select role in ('admin', 'manager') from public.profiles
      where id = auth.uid() and is_active),
    false)
$$;

comment on function public.is_admin() is
  '관리자(교감) 또는 부장. 학교 전체 데이터를 다룰 수 있는 권한.';

-- 같은 학교 소속인지 — 모든 정책의 기본 술어
create or replace function public.same_school(target uuid)
returns boolean
language sql
stable
as $$
  select target is not null and target = public.current_school_id()
$$;

-- -----------------------------------------------------------------------------
-- 부서
-- -----------------------------------------------------------------------------
create table public.departments (
  id         uuid primary key default gen_random_uuid(),
  school_id  uuid not null references public.schools(id) on delete cascade,
  name       text not null,
  head_id    uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (school_id, name)
);

alter table public.profiles
  add constraint profiles_department_fk
  foreign key (department_id) references public.departments(id) on delete set null;

create trigger departments_touch before update on public.departments
  for each row execute function public.touch_updated_at();

-- -----------------------------------------------------------------------------
-- 학년도 · 학기
-- -----------------------------------------------------------------------------
create table public.terms (
  id               uuid primary key default gen_random_uuid(),
  school_id        uuid not null references public.schools(id) on delete cascade,
  year             smallint not null,
  semester         smallint not null check (semester in (1, 2)),
  starts_on        date not null,
  ends_on          date not null,
  -- 중학교 자유학기 여부. 자유학기에는 주제선택활동 그룹 배정이 늘어난다.
  is_free_semester boolean not null default false,
  is_current       boolean not null default false,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  unique (school_id, year, semester),
  check (ends_on > starts_on)
);

create trigger terms_touch before update on public.terms
  for each row execute function public.touch_updated_at();

-- -----------------------------------------------------------------------------
-- 과정별 시정표
--
-- 초·중·고·전공과의 교시 시각이 서로 다르다. 이 표가 "교시 번호 → 실제 시각"
-- 변환의 유일한 출처이며, 충돌 검사는 전부 여기서 나온 분(minute) 값으로 한다.
-- -----------------------------------------------------------------------------
create table public.periods (
  id           uuid primary key default gen_random_uuid(),
  school_id    uuid not null references public.schools(id) on delete cascade,
  course       course_level not null,
  period_no    smallint not null check (period_no between 0 and 15),
  label        text not null,
  starts_min   smallint not null check (starts_min between 0 and 1440),
  ends_min     smallint not null check (ends_min between 0 and 1440),
  -- 방과후 시간대 여부. 정규 수업과 우선순위가 다르다.
  is_afterschool boolean not null default false,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  unique (school_id, course, period_no),
  check (ends_min > starts_min)
);

comment on column public.periods.starts_min is '자정부터의 분. 09:00 = 540';

create trigger periods_touch before update on public.periods
  for each row execute function public.touch_updated_at();

-- 교시 번호 → 분 구간 조회 (트리거에서 사용)
create or replace function public.period_minutes(
  p_school uuid, p_course course_level, p_period smallint
)
returns table (starts_min smallint, ends_min smallint)
language sql
stable
security definer
set search_path = public
as $$
  select p.starts_min, p.ends_min
  from public.periods p
  where p.school_id = p_school and p.course = p_course and p.period_no = p_period
$$;

-- -----------------------------------------------------------------------------
-- 교과
-- -----------------------------------------------------------------------------
create table public.subjects (
  id         uuid primary key default gen_random_uuid(),
  school_id  uuid not null references public.schools(id) on delete cascade,
  name       text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (school_id, name)
);

create trigger subjects_touch before update on public.subjects
  for each row execute function public.touch_updated_at();

-- -----------------------------------------------------------------------------
-- 학급
-- -----------------------------------------------------------------------------
create table public.classes (
  id                  uuid primary key default gen_random_uuid(),
  school_id           uuid not null references public.schools(id) on delete cascade,
  course              course_level not null,
  grade               smallint not null,
  name                text not null,
  homeroom_teacher_id uuid references public.profiles(id) on delete set null,
  assistant_teacher_id uuid references public.profiles(id) on delete set null,
  student_count       smallint not null default 0,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  unique (school_id, course, grade, name)
);

create index classes_school_idx on public.classes(school_id, course);
create trigger classes_touch before update on public.classes
  for each row execute function public.touch_updated_at();

-- -----------------------------------------------------------------------------
-- 수강 그룹 — 고교학점제 선택과목, 자유학기 주제선택활동
--
-- 학급 단위가 아니라 여러 학급에서 모인 학생 묶음이라 별도 엔티티가 필요하다.
-- -----------------------------------------------------------------------------
create table public.course_groups (
  id         uuid primary key default gen_random_uuid(),
  school_id  uuid not null references public.schools(id) on delete cascade,
  term_id    uuid not null references public.terms(id) on delete cascade,
  course     course_level not null,
  name       text not null,
  subject_id uuid references public.subjects(id) on delete set null,
  -- 어느 학급들에서 학생이 모이는지. 학급 충돌 검사에 쓰인다.
  member_class_ids uuid[] not null default '{}',
  student_count smallint not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (school_id, term_id, name)
);

create trigger course_groups_touch before update on public.course_groups
  for each row execute function public.touch_updated_at();

-- -----------------------------------------------------------------------------
-- 특별실
-- -----------------------------------------------------------------------------
create table public.rooms (
  id                uuid primary key default gen_random_uuid(),
  school_id         uuid not null references public.schools(id) on delete cascade,
  name              text not null,
  room_type         text not null default 'general',
  floor             smallint,
  capacity          smallint,
  -- 용도 태그. 추천 엔진이 "요리실습실 ↔ 직업실습" 적합도를 계산할 때 쓴다.
  features          text[] not null default '{}',
  managed_by        uuid references public.departments(id) on delete set null,
  requires_approval boolean not null default false,
  is_active         boolean not null default true,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  unique (school_id, name)
);

create index rooms_school_idx on public.rooms(school_id) where is_active;
create trigger rooms_touch before update on public.rooms
  for each row execute function public.touch_updated_at();

-- -----------------------------------------------------------------------------
-- 학생 — 가명처리
--
-- 실명·생년월일·주소·연락처·진단명 컬럼을 의도적으로 만들지 않는다.
-- 실명 대조표는 이 앱 밖(담임 개인 관리)에 둔다. 유출되어도 개인을 식별할 수 없다.
-- -----------------------------------------------------------------------------
create table public.students (
  id           uuid primary key default gen_random_uuid(),
  school_id    uuid not null references public.schools(id) on delete cascade,
  class_id     uuid references public.classes(id) on delete set null,
  student_code text not null,
  display_name text not null,
  is_active    boolean not null default true,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  unique (school_id, student_code)
);

comment on table public.students is
  '가명처리 원칙. 실명 컬럼을 추가하지 말 것 — 장애 관련 정보는 개인정보보호법 제23조 민감정보다.';
comment on column public.students.display_name is '이니셜 또는 별칭 (예: 김ㅇㅅ, 3-1 가온)';

create trigger students_touch before update on public.students
  for each row execute function public.touch_updated_at();

-- -----------------------------------------------------------------------------
-- 초대 — 공개 회원가입은 없다. 관리자가 등록한 이메일만 가입할 수 있다.
-- -----------------------------------------------------------------------------
create table public.invitations (
  id          uuid primary key default gen_random_uuid(),
  school_id   uuid not null references public.schools(id) on delete cascade,
  email       text not null,
  name        text not null,
  role        user_role not null default 'teacher',
  employment  employment_type not null default 'full_time',
  department_id uuid references public.departments(id) on delete set null,
  -- 토큰 평문은 저장하지 않는다. 메일로만 전달되고 DB 에는 해시만 남는다.
  token_hash  text not null unique,
  expires_at  timestamptz not null,
  accepted_at timestamptz,
  invited_by  uuid references public.profiles(id) on delete set null,
  created_at  timestamptz not null default now()
);

create index invitations_email_idx on public.invitations(school_id, email)
  where accepted_at is null;

-- =============================================================================
-- RLS
-- =============================================================================
alter table public.schools       enable row level security;
alter table public.profiles      enable row level security;
alter table public.departments   enable row level security;
alter table public.terms         enable row level security;
alter table public.periods       enable row level security;
alter table public.subjects      enable row level security;
alter table public.classes       enable row level security;
alter table public.course_groups enable row level security;
alter table public.rooms         enable row level security;
alter table public.students      enable row level security;
alter table public.invitations   enable row level security;

-- 학교: 자기 학교만 조회, 수정은 관리자만
create policy schools_select on public.schools for select
  using (id = public.current_school_id());
create policy schools_update on public.schools for update
  using (id = public.current_school_id() and public.is_admin());

-- 프로필: 같은 학교 조회, 본인 또는 관리자만 수정
create policy profiles_select on public.profiles for select
  using (public.same_school(school_id));
create policy profiles_update_self on public.profiles for update
  using (id = auth.uid());
create policy profiles_update_admin on public.profiles for update
  using (public.same_school(school_id) and public.is_admin());

-- 기준정보: 같은 학교면 조회, 변경은 관리자만
do $$
declare t text;
begin
  foreach t in array array[
    'departments', 'terms', 'periods', 'subjects',
    'classes', 'course_groups', 'rooms'
  ]
  loop
    execute format(
      'create policy %1$s_select on public.%1$s for select
         using (public.same_school(school_id))', t);
    execute format(
      'create policy %1$s_write on public.%1$s for all
         using (public.same_school(school_id) and public.is_admin())
         with check (public.same_school(school_id) and public.is_admin())', t);
  end loop;
end $$;

-- 학생: 같은 학교 교직원은 조회 가능, 변경은 관리자만.
-- (개별 조회 기록은 애플리케이션에서 audit_logs 에 남긴다)
create policy students_select on public.students for select
  using (public.same_school(school_id));
create policy students_write on public.students for all
  using (public.same_school(school_id) and public.is_admin())
  with check (public.same_school(school_id) and public.is_admin());

-- 초대: 관리자만. 수락은 service role 로 처리한다.
create policy invitations_admin on public.invitations for all
  using (public.same_school(school_id) and public.is_admin())
  with check (public.same_school(school_id) and public.is_admin());


-- ─────────────────────────────────────────────────────────────────────────────
-- 0002_scheduling.sql
-- ─────────────────────────────────────────────────────────────────────────────

-- =============================================================================
-- 0002_scheduling — 정규 시간표 · 특별실 예약
--
-- 핵심: 이중예약을 애플리케이션이 아니라 DB 제약으로 막는다.
-- 동시 요청 두 건이 같은 순간에 들어와도 EXCLUDE 제약이 하나를 거부한다.
-- 애플리케이션 검사만으로는 이 경쟁 조건을 막을 수 없다.
-- =============================================================================

create type booking_kind as enum (
  'regular',              -- 정규 교과
  'onetime',              -- 일회성 사용
  'afterschool',          -- 방과후
  'vocational_practice',  -- 전공과 직업실습
  'co_teaching'           -- 강사협력수업
);

create type booking_status as enum ('pending', 'approved', 'rejected', 'cancelled');

-- -----------------------------------------------------------------------------
-- 교시 번호 → 실제 분(minute) 을 채우는 트리거
--
-- 과정마다 시정이 다르므로 시각은 반드시 periods 를 거쳐 계산한다.
-- 클라이언트가 보낸 시각을 믿지 않는다.
-- -----------------------------------------------------------------------------
create or replace function public.fill_period_minutes()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_start smallint;
  v_end   smallint;
begin
  select p.starts_min, p.ends_min into v_start, v_end
  from public.periods p
  where p.school_id = new.school_id
    and p.course = new.course
    and p.period_no = new.period_no;

  if v_start is null then
    raise exception '시정표에 없는 교시입니다 (과정=%, %교시). 관리자 > 시정표에서 먼저 등록하세요.',
      new.course, new.period_no
      using errcode = 'foreign_key_violation';
  end if;

  new.starts_min := v_start;
  new.ends_min := v_end;
  return new;
end;
$$;

-- -----------------------------------------------------------------------------
-- 정규 시간표
-- -----------------------------------------------------------------------------
create table public.timetable_slots (
  id           uuid primary key default gen_random_uuid(),
  school_id    uuid not null references public.schools(id) on delete cascade,
  term_id      uuid not null references public.terms(id) on delete cascade,
  course       course_level not null,
  day_of_week  smallint not null check (day_of_week between 1 and 7),
  period_no    smallint not null,
  starts_min   smallint not null default 0,
  ends_min     smallint not null default 0,

  -- 학급 수업이거나 수강그룹 수업이거나, 정확히 하나여야 한다.
  class_id        uuid references public.classes(id) on delete cascade,
  course_group_id uuid references public.course_groups(id) on delete cascade,

  teacher_id    uuid references public.profiles(id) on delete set null,
  co_teacher_id uuid references public.profiles(id) on delete set null,
  subject_id    uuid references public.subjects(id) on delete set null,
  room_id       uuid references public.rooms(id) on delete set null,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint timetable_target_exactly_one
    check ((class_id is not null) <> (course_group_id is not null)),
  constraint timetable_co_teacher_differs
    check (co_teacher_id is null or co_teacher_id <> teacher_id)
);

create trigger timetable_fill_minutes
  before insert or update of course, period_no, school_id on public.timetable_slots
  for each row execute function public.fill_period_minutes();

create trigger timetable_touch before update on public.timetable_slots
  for each row execute function public.touch_updated_at();

create index timetable_teacher_idx on public.timetable_slots(term_id, teacher_id, day_of_week);
create index timetable_class_idx   on public.timetable_slots(term_id, class_id, day_of_week);
create index timetable_room_idx    on public.timetable_slots(term_id, room_id, day_of_week);

-- 같은 학기·같은 요일에 한 교사가 겹치는 시각에 두 수업을 가질 수 없다.
-- 과정별 시정이 달라도 분 단위 비교라 정확히 걸린다.
alter table public.timetable_slots
  add constraint timetable_teacher_no_overlap
  exclude using gist (
    term_id with =,
    teacher_id with =,
    day_of_week with =,
    int4range(starts_min::int, ends_min::int) with &&
  ) where (teacher_id is not null);

-- -----------------------------------------------------------------------------
-- 특별실 사용 불가 구간 (점검·전용시간·행사)
-- -----------------------------------------------------------------------------
create table public.room_blackouts (
  id         uuid primary key default gen_random_uuid(),
  school_id  uuid not null references public.schools(id) on delete cascade,
  room_id    uuid not null references public.rooms(id) on delete cascade,
  starts_on  date not null,
  ends_on    date not null,
  starts_min smallint not null default 0,
  ends_min   smallint not null default 1440,
  reason     text not null,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  check (ends_on >= starts_on and ends_min > starts_min)
);

create index room_blackouts_lookup on public.room_blackouts(room_id, starts_on, ends_on);

-- -----------------------------------------------------------------------------
-- 정기 예약 규칙
--
-- 규칙을 저장하고, 날짜별 행을 실제로 생성(materialize)한다.
-- 그래야 충돌 검사가 단순 인덱스 조회로 끝나고 DB 제약도 걸 수 있다.
-- -----------------------------------------------------------------------------
create table public.room_reservation_rules (
  id           uuid primary key default gen_random_uuid(),
  school_id    uuid not null references public.schools(id) on delete cascade,
  term_id      uuid not null references public.terms(id) on delete cascade,
  room_id      uuid not null references public.rooms(id) on delete cascade,
  course       course_level not null,
  day_of_week  smallint not null check (day_of_week between 1 and 7),
  period_no    smallint not null,
  effective_from date not null,
  effective_to   date not null,

  class_id        uuid references public.classes(id) on delete cascade,
  course_group_id uuid references public.course_groups(id) on delete cascade,
  requester_id    uuid not null references public.profiles(id) on delete cascade,
  co_teacher_id   uuid references public.profiles(id) on delete set null,

  kind       booking_kind not null default 'regular',
  purpose    text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  check (effective_to >= effective_from),
  constraint rule_target_exactly_one
    check ((class_id is not null) <> (course_group_id is not null))
);

create trigger room_rules_touch before update on public.room_reservation_rules
  for each row execute function public.touch_updated_at();

-- -----------------------------------------------------------------------------
-- 특별실 예약 (날짜 단위 실제 행)
-- -----------------------------------------------------------------------------
create table public.room_reservations (
  id            uuid primary key default gen_random_uuid(),
  school_id     uuid not null references public.schools(id) on delete cascade,
  rule_id       uuid references public.room_reservation_rules(id) on delete cascade,
  room_id       uuid not null references public.rooms(id) on delete cascade,
  reserved_date date not null,
  course        course_level not null,
  period_no     smallint not null,
  starts_min    smallint not null default 0,
  ends_min      smallint not null default 0,

  class_id        uuid references public.classes(id) on delete set null,
  course_group_id uuid references public.course_groups(id) on delete set null,
  requester_id    uuid not null references public.profiles(id) on delete cascade,
  co_teacher_id   uuid references public.profiles(id) on delete set null,

  kind        booking_kind not null default 'onetime',
  status      booking_status not null default 'approved',
  purpose     text,
  approved_by uuid references public.profiles(id) on delete set null,
  approved_at timestamptz,
  reject_reason text,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger reservations_fill_minutes
  before insert or update of course, period_no, school_id on public.room_reservations
  for each row execute function public.fill_period_minutes();

create trigger reservations_touch before update on public.room_reservations
  for each row execute function public.touch_updated_at();

create index reservations_room_date on public.room_reservations(room_id, reserved_date);
create index reservations_requester on public.room_reservations(requester_id, reserved_date);
create index reservations_pending   on public.room_reservations(school_id, status)
  where status = 'pending';

-- ★ 이중예약 원천 차단.
--   승인된 예약끼리는 같은 특별실·같은 날짜에 시각이 겹칠 수 없다.
--   교시 번호가 아니라 분 구간으로 비교하므로 과정별 시정 차이도 정확히 잡는다.
alter table public.room_reservations
  add constraint room_no_double_booking
  exclude using gist (
    room_id with =,
    reserved_date with =,
    int4range(starts_min::int, ends_min::int) with &&
  ) where (status = 'approved');

-- =============================================================================
-- RLS
-- =============================================================================
alter table public.timetable_slots         enable row level security;
alter table public.room_blackouts          enable row level security;
alter table public.room_reservation_rules  enable row level security;
alter table public.room_reservations       enable row level security;

-- 시간표는 전 교직원이 조회한다 (누가 언제 비는지 알아야 결보강이 굴러간다).
create policy timetable_select on public.timetable_slots for select
  using (public.same_school(school_id));
create policy timetable_write on public.timetable_slots for all
  using (public.same_school(school_id) and public.is_admin())
  with check (public.same_school(school_id) and public.is_admin());

create policy blackouts_select on public.room_blackouts for select
  using (public.same_school(school_id));
create policy blackouts_write on public.room_blackouts for all
  using (public.same_school(school_id) and public.is_admin())
  with check (public.same_school(school_id) and public.is_admin());

-- 예약은 조회는 모두, 생성은 본인 명의로만, 수정·취소는 본인 또는 관리자만.
create policy rules_select on public.room_reservation_rules for select
  using (public.same_school(school_id));
create policy rules_insert on public.room_reservation_rules for insert
  with check (public.same_school(school_id) and (requester_id = auth.uid() or public.is_admin()));
create policy rules_update on public.room_reservation_rules for update
  using (public.same_school(school_id) and (requester_id = auth.uid() or public.is_admin()));
create policy rules_delete on public.room_reservation_rules for delete
  using (public.same_school(school_id) and (requester_id = auth.uid() or public.is_admin()));

create policy reservations_select on public.room_reservations for select
  using (public.same_school(school_id));
create policy reservations_insert on public.room_reservations for insert
  with check (public.same_school(school_id) and (requester_id = auth.uid() or public.is_admin()));
create policy reservations_update on public.room_reservations for update
  using (public.same_school(school_id) and (requester_id = auth.uid() or public.is_admin()));
create policy reservations_delete on public.room_reservations for delete
  using (public.same_school(school_id) and (requester_id = auth.uid() or public.is_admin()));


-- ─────────────────────────────────────────────────────────────────────────────
-- 0003_substitution.sql
-- ─────────────────────────────────────────────────────────────────────────────

-- =============================================================================
-- 0003_substitution — 결보강
--
-- 흐름: 결과 신청 → 해당 시각 수업 자동 추출 → 후보 추천 → 확정 → 월별 정산
-- 배정 가중치는 학교마다 다르므로 코드가 아니라 substitution_rules 에 둔다.
-- =============================================================================

create type absence_reason as enum (
  'business_trip',  -- 출장
  'sick',           -- 병가
  'annual',         -- 연가
  'training',       -- 연수
  'official',       -- 공가
  'other'
);

create type substitution_status as enum ('pending', 'assigned', 'confirmed', 'declined');

-- -----------------------------------------------------------------------------
-- 결과 신청
-- -----------------------------------------------------------------------------
create table public.absences (
  id         uuid primary key default gen_random_uuid(),
  school_id  uuid not null references public.schools(id) on delete cascade,
  teacher_id uuid not null references public.profiles(id) on delete cascade,
  starts_on  date not null,
  ends_on    date not null,
  reason     absence_reason not null,
  note       text,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (ends_on >= starts_on)
);

create index absences_teacher_idx on public.absences(teacher_id, starts_on, ends_on);
create index absences_school_idx  on public.absences(school_id, starts_on);

create trigger absences_touch before update on public.absences
  for each row execute function public.touch_updated_at();

-- -----------------------------------------------------------------------------
-- 결보강 배정
--
-- 결과 신청 1건에서 (날짜 × 교시) 단위로 여러 행이 생성된다.
-- -----------------------------------------------------------------------------
create table public.substitution_assignments (
  id          uuid primary key default gen_random_uuid(),
  school_id   uuid not null references public.schools(id) on delete cascade,
  absence_id  uuid not null references public.absences(id) on delete cascade,
  assign_date date not null,
  course      course_level not null,
  period_no   smallint not null,
  starts_min  smallint not null default 0,
  ends_min    smallint not null default 0,

  -- 원 수업 (시간표가 바뀌어도 배정 이력은 남아야 하므로 set null)
  timetable_slot_id uuid references public.timetable_slots(id) on delete set null,
  class_id          uuid references public.classes(id) on delete set null,
  course_group_id   uuid references public.course_groups(id) on delete set null,
  subject_id        uuid references public.subjects(id) on delete set null,
  room_id           uuid references public.rooms(id) on delete set null,

  assigned_teacher_id uuid references public.profiles(id) on delete set null,
  status              substitution_status not null default 'pending',
  -- 추천 당시 점수. 왜 이 사람이 뽑혔는지 나중에 설명할 수 있어야 한다.
  score               integer,
  score_breakdown     jsonb,
  -- 시간강사 수당 정산 대상 여부
  is_paid             boolean not null default false,
  note                text,
  assigned_by         uuid references public.profiles(id) on delete set null,
  assigned_at         timestamptz,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger substitution_fill_minutes
  before insert or update of course, period_no, school_id on public.substitution_assignments
  for each row execute function public.fill_period_minutes();

create trigger substitution_touch before update on public.substitution_assignments
  for each row execute function public.touch_updated_at();

create index substitution_date_idx     on public.substitution_assignments(school_id, assign_date);
create index substitution_assignee_idx on public.substitution_assignments(assigned_teacher_id, assign_date);
create index substitution_pending_idx  on public.substitution_assignments(school_id, status)
  where status = 'pending';
create index substitution_payroll_idx  on public.substitution_assignments(school_id, assign_date)
  where is_paid;

-- 한 교사가 같은 날 겹치는 시각에 두 개의 결보강을 맡을 수 없다.
alter table public.substitution_assignments
  add constraint substitution_assignee_no_overlap
  exclude using gist (
    assign_date with =,
    assigned_teacher_id with =,
    int4range(starts_min::int, ends_min::int) with &&
  ) where (assigned_teacher_id is not null and status <> 'declined');

-- -----------------------------------------------------------------------------
-- 배정 가중치 — 관리자 설정 화면과 1:1로 연결된다
-- -----------------------------------------------------------------------------
create table public.substitution_rules (
  school_id  uuid primary key references public.schools(id) on delete cascade,
  weights    jsonb not null default jsonb_build_object(
    'partTimeFirst',      30,   -- 시간강사 우선
    'sameSubject',        25,   -- 동일 교과 담당 가능
    'sameCourseGrade',    20,   -- 동일 과정/학년
    'homeroomOfClass',    15,   -- 해당 학급 담임·부담임
    'fairnessMax',        20,   -- 주당 누적 결보강 형평성 (적을수록 가점)
    'longRunPenalty',    -25,   -- 연강 4교시 이상 발생
    'sameFloorBonus',      5    -- 이전·다음 교시 같은 층
  ),
  -- 연강 몇 교시부터 페널티를 줄지
  long_run_threshold smallint not null default 4,
  updated_by uuid references public.profiles(id) on delete set null,
  updated_at timestamptz not null default now()
);

comment on table public.substitution_rules is
  '학교마다 결보강 원칙이 달라 코드에 고정하지 않는다. 관리자 > 결보강 규칙 화면에서 조정한다.';

-- =============================================================================
-- RLS
-- =============================================================================
alter table public.absences                 enable row level security;
alter table public.substitution_assignments enable row level security;
alter table public.substitution_rules       enable row level security;

-- 결과는 전 교직원이 본다 (누가 비는지 알아야 결보강이 굴러간다).
-- 신청은 본인 것만, 관리자는 대리 신청 가능.
create policy absences_select on public.absences for select
  using (public.same_school(school_id));
create policy absences_insert on public.absences for insert
  with check (public.same_school(school_id) and (teacher_id = auth.uid() or public.is_admin()));
create policy absences_update on public.absences for update
  using (public.same_school(school_id) and (teacher_id = auth.uid() or public.is_admin()));
create policy absences_delete on public.absences for delete
  using (public.same_school(school_id) and (teacher_id = auth.uid() or public.is_admin()));

-- 배정 확정은 관리자만. 본인 배정은 수락/거절할 수 있다.
create policy substitution_select on public.substitution_assignments for select
  using (public.same_school(school_id));
create policy substitution_admin on public.substitution_assignments for all
  using (public.same_school(school_id) and public.is_admin())
  with check (public.same_school(school_id) and public.is_admin());
create policy substitution_respond on public.substitution_assignments for update
  using (public.same_school(school_id) and assigned_teacher_id = auth.uid());

create policy sub_rules_select on public.substitution_rules for select
  using (public.same_school(school_id));
create policy sub_rules_write on public.substitution_rules for all
  using (public.same_school(school_id) and public.is_admin())
  with check (public.same_school(school_id) and public.is_admin());


-- ─────────────────────────────────────────────────────────────────────────────
-- 0004_calendar.sql
-- ─────────────────────────────────────────────────────────────────────────────

-- =============================================================================
-- 0004_calendar — 학사일정 · 과정별 행사
--
-- 범위(scope) 를 학교/과정/학년/학급/부서로 나눠 저장한다.
-- 초등 교사에게 전공과 행사가 쏟아지지 않게 하는 것이 이 표의 목적이다.
-- =============================================================================

create type event_scope as enum ('school', 'course', 'grade', 'class', 'department');

create type event_category as enum (
  'academic',    -- 학사일정 (입학·졸업·개학)
  'grade_event', -- 학년행사
  'course_event',-- 과정행사
  'class_event', -- 학급행사
  'exam',        -- 평가
  'vacation',    -- 방학
  'holiday',     -- 휴업일
  'training',    -- 연수·협의회
  'other'
);

create table public.academic_events (
  id         uuid primary key default gen_random_uuid(),
  school_id  uuid not null references public.schools(id) on delete cascade,
  title      text not null,
  detail     text,
  starts_on  date not null,
  ends_on    date not null,
  all_day    boolean not null default true,
  starts_min smallint,
  ends_min   smallint,

  scope      event_scope not null default 'school',
  -- scope 에 따라 해석이 달라진다:
  --   course     → scope_course 사용
  --   grade      → scope_course + scope_grade
  --   class      → scope_class_id
  --   department → scope_department_id
  scope_course        course_level,
  scope_grade         smallint,
  scope_class_id      uuid references public.classes(id) on delete cascade,
  scope_department_id uuid references public.departments(id) on delete cascade,

  category   event_category not null default 'other',
  color      text,

  -- 나이스에서 동기화한 건은 수동 입력분과 구분한다.
  -- 구분하지 않으면 다음 동기화 때 교사가 손으로 넣은 일정을 덮어써 버린다.
  source        text not null default 'manual',
  source_key    text,

  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  check (ends_on >= starts_on),
  check (all_day or (starts_min is not null and ends_min is not null and ends_min > starts_min)),
  constraint event_scope_ref_matches check (
    case scope
      when 'course'     then scope_course is not null
      when 'grade'      then scope_course is not null and scope_grade is not null
      when 'class'      then scope_class_id is not null
      when 'department' then scope_department_id is not null
      else true
    end
  )
);

create trigger academic_events_touch before update on public.academic_events
  for each row execute function public.touch_updated_at();

create index events_range_idx on public.academic_events(school_id, starts_on, ends_on);
create index events_scope_idx on public.academic_events(school_id, scope);

-- 나이스 동기화 건은 source_key 로 멱등하게 갱신한다 (중복 생성 방지).
create unique index events_source_key_uniq
  on public.academic_events(school_id, source, source_key)
  where source <> 'manual' and source_key is not null;

-- -----------------------------------------------------------------------------
-- 개인 캘린더 구독 토큰 (ICS)
--
-- 토큰만 알면 인증 없이 일정을 읽으므로, 노출 시 교체할 수 있어야 한다.
-- -----------------------------------------------------------------------------
alter table public.profiles
  add column calendar_token uuid not null default gen_random_uuid();

create unique index profiles_calendar_token_uniq on public.profiles(calendar_token);

-- =============================================================================
-- RLS
-- =============================================================================
alter table public.academic_events enable row level security;

-- 조회: 같은 학교면 모두 본다. 범위 필터는 화면에서 건다.
-- (일정은 민감정보가 아니고, 오히려 서로 알아야 협업이 된다)
create policy events_select on public.academic_events for select
  using (public.same_school(school_id));

-- 입력: 관리자는 전체, 일반 교사는 자기 학급 행사만 등록할 수 있다.
create policy events_insert_admin on public.academic_events for insert
  with check (public.same_school(school_id) and public.is_admin());

create policy events_insert_class on public.academic_events for insert
  with check (
    public.same_school(school_id)
    and scope = 'class'
    and exists (
      select 1 from public.classes c
      where c.id = scope_class_id
        and (c.homeroom_teacher_id = auth.uid() or c.assistant_teacher_id = auth.uid())
    )
  );

create policy events_update on public.academic_events for update
  using (
    public.same_school(school_id)
    and (public.is_admin() or created_by = auth.uid())
  );

create policy events_delete on public.academic_events for delete
  using (
    public.same_school(school_id)
    and (public.is_admin() or created_by = auth.uid())
  );


-- ─────────────────────────────────────────────────────────────────────────────
-- 0005_security.sql
-- ─────────────────────────────────────────────────────────────────────────────

-- =============================================================================
-- 0005_security — 감사로그 · AI 캐시 · 동의 기록
--
-- 개인정보의 안전성 확보조치 기준에 따라 개인정보 조회·수정 기록을 남긴다.
-- 민감정보를 처리하므로 보관기간은 2년으로 잡는다.
-- =============================================================================

create table public.audit_logs (
  id          bigserial primary key,
  school_id   uuid references public.schools(id) on delete set null,
  actor_id    uuid references public.profiles(id) on delete set null,
  actor_name  text,
  action      text not null,
  target_table text,
  target_id   text,
  -- 무엇이 바뀌었는지. 개인정보 원문은 넣지 않고 컬럼명·건수 수준만 남긴다.
  meta        jsonb,
  ip          inet,
  user_agent  text,
  created_at  timestamptz not null default now()
);

comment on table public.audit_logs is
  '개인정보 조회·수정 기록. 2년 보관. meta 에 개인정보 원문을 넣지 말 것.';

create index audit_school_time on public.audit_logs(school_id, created_at desc);
create index audit_actor_time  on public.audit_logs(actor_id, created_at desc);

-- 2년 지난 기록 파기 (Vercel Cron 에서 호출)
create or replace function public.purge_expired_audit_logs()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  removed integer;
begin
  delete from public.audit_logs where created_at < now() - interval '2 years';
  get diagnostics removed = row_count;
  return removed;
end;
$$;

-- -----------------------------------------------------------------------------
-- 민감 구역 진입 동의 기록
--
-- "학생 지원" 메뉴 진입 시 경고를 확인했다는 기록. 세션당 1회.
-- -----------------------------------------------------------------------------
create table public.sensitivity_acks (
  id          bigserial primary key,
  school_id   uuid not null references public.schools(id) on delete cascade,
  profile_id  uuid not null references public.profiles(id) on delete cascade,
  zone        text not null,
  acked_at    timestamptz not null default now()
);

create index sensitivity_acks_lookup
  on public.sensitivity_acks(profile_id, zone, acked_at desc);

-- -----------------------------------------------------------------------------
-- AI 결과 캐시
--
-- 무료 Gemini 티어의 호출 한도를 아끼기 위한 캐시.
-- 캐시 키는 "마스킹을 마친 텍스트" 기준이라 캐시에도 개인정보가 남지 않는다.
-- -----------------------------------------------------------------------------
create table public.ai_cache (
  id         uuid primary key default gen_random_uuid(),
  school_id  uuid not null references public.schools(id) on delete cascade,
  tool       text not null,
  input_hash text not null,
  result     jsonb not null,
  hit_count  integer not null default 0,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default now() + interval '7 days',
  unique (school_id, tool, input_hash)
);

create index ai_cache_expiry on public.ai_cache(expires_at);

create or replace function public.purge_expired_ai_cache()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  removed integer;
begin
  delete from public.ai_cache where expires_at < now();
  get diagnostics removed = row_count;
  return removed;
end;
$$;

-- -----------------------------------------------------------------------------
-- AI 사용 이력
--
-- 프롬프트 원문과 응답은 저장하지 않는다. "누가 언제 어떤 툴을 썼는지"만 남긴다.
-- 원문을 남기면 개인정보를 앱 밖으로 보낸 것도 모자라 앱 안에도 쌓이게 된다.
-- -----------------------------------------------------------------------------
create table public.ai_usage_logs (
  id          bigserial primary key,
  school_id   uuid not null references public.schools(id) on delete cascade,
  profile_id  uuid references public.profiles(id) on delete set null,
  tool        text not null,
  key_source  text not null,            -- 'school' | 'personal'
  cache_hit   boolean not null default false,
  masked_count integer not null default 0,
  ok          boolean not null default true,
  error_code  text,
  created_at  timestamptz not null default now()
);

create index ai_usage_school_time on public.ai_usage_logs(school_id, created_at desc);

-- -----------------------------------------------------------------------------
-- 학교 공용 Gemini 키
-- -----------------------------------------------------------------------------
alter table public.schools
  add column gemini_key_enc  text,
  add column gemini_key_hint text;

comment on column public.schools.gemini_key_enc is
  'AES-256-GCM 암호문. 복호화 키는 서버 환경변수 GEMINI_KEY_ENCRYPTION_KEY.';

-- =============================================================================
-- RLS
-- =============================================================================
alter table public.audit_logs        enable row level security;
alter table public.sensitivity_acks  enable row level security;
alter table public.ai_cache          enable row level security;
alter table public.ai_usage_logs     enable row level security;

-- 감사로그는 관리자만 읽는다. 쓰기는 서버(service role)만 — 교직원이 자기 기록을
-- 지울 수 있으면 감사로그의 의미가 없다.
create policy audit_select_admin on public.audit_logs for select
  using (public.same_school(school_id) and public.is_admin());

-- 동의 기록은 본인 것만
create policy acks_own on public.sensitivity_acks for select
  using (profile_id = auth.uid());
create policy acks_insert_own on public.sensitivity_acks for insert
  with check (public.same_school(school_id) and profile_id = auth.uid());

-- AI 캐시는 같은 학교 안에서 공유한다 (같은 검색을 반복하지 않게)
create policy ai_cache_select on public.ai_cache for select
  using (public.same_school(school_id));

create policy ai_usage_select on public.ai_usage_logs for select
  using (public.same_school(school_id) and (profile_id = auth.uid() or public.is_admin()));


-- ─────────────────────────────────────────────────────────────────────────────
-- 0006_realtime.sql
-- ─────────────────────────────────────────────────────────────────────────────

-- =============================================================================
-- 0006_realtime — 특별실 예약·결보강·학사일정을 실시간으로 반영
--
-- "체험하기"로 여러 사람이 동시에 들어와 같은 데이터를 만질 때, 한쪽이
-- 바꾼 내용이 다른 쪽 화면에 새로고침 없이 바로 보이게 한다.
--
-- Supabase 는 프로젝트마다 빈 supabase_realtime publication 을 미리 만들어
-- 둔다. 여기에 테이블을 추가해야 그 테이블의 변경이 클라이언트로 방송된다.
-- RLS 가 걸린 테이블은 Realtime 도 같은 정책을 따르므로, 구독한 사람이
-- 원래 볼 수 없는 학교의 행은 여기서도 오지 않는다.
--
-- pg_publication_tables 로 이미 들어있는지 먼저 확인한다 — schema.sql 을
-- 처음부터 다시 실행하는 경로(테이블을 지웠다 새로 만듦)에서는 항상
-- 비어있어 문제없지만, 이 파일 하나만 다시 돌리는 경우에도 안전하게
-- 만들어 둔다.
-- =============================================================================

do $$
declare
  t text;
begin
  foreach t in array array[
    'room_reservations',
    'substitution_assignments',
    'absences',
    'academic_events'
  ]
  loop
    if not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = t
    ) then
      execute format('alter publication supabase_realtime add table public.%I', t);
    end if;
  end loop;
end $$;


-- ─────────────────────────────────────────────────────────────────────────────
-- 0007_events_open.sql
-- ─────────────────────────────────────────────────────────────────────────────

-- =============================================================================
-- 0007_events_open — 학사일정·행사 등록을 모든 교직원에게 연다
--
-- 예전에는 담임인 학급 행사만 넣을 수 있고, 전교·과정·학년 단위는 관리자만
-- 넣을 수 있었다. 결재나 승인 단계가 있던 것은 아니고 그냥 RLS 로 막혀
-- 있었을 뿐인데, 화면에는 "등록할 수 없습니다"로만 보여 승인이 필요한
-- 것처럼 느껴졌다. 일정은 민감정보가 아니고 서로 알아야 협업이 되는
-- 정보라, 같은 학교 교직원이면 범위에 상관없이 바로 등록하게 연다.
--
-- 두 개였던 insert 정책(관리자용·담임용)을 하나로 합친다.
-- =============================================================================

drop policy if exists events_insert_admin on public.academic_events;
drop policy if exists events_insert_class on public.academic_events;

create policy events_insert on public.academic_events for insert
  with check (public.same_school(school_id));


-- ─────────────────────────────────────────────────────────────────────────────
-- 0008_budget.sql
-- ─────────────────────────────────────────────────────────────────────────────

-- =============================================================================
-- 0008_budget — 학급·부서 예산 (Phase 2)
--
-- 흐름은 "예산 항목(배정) → 지출 신청(품의) → 승인(집행 확정)" 3단계다.
-- 잔액은 별도 컬럼으로 저장하지 않는다 — 배정액에서 승인된 지출의 합을
-- 빼는 것뿐이라, 저장해 두면 동시 승인 때 어긋날 수 있는 값을 굳이
-- 만들 이유가 없다. 화면에서 매번 더해서 보여준다.
-- =============================================================================

create table public.budget_lines (
  id               uuid primary key default gen_random_uuid(),
  school_id        uuid not null references public.schools(id) on delete cascade,
  fiscal_year      integer not null default extract(year from now()),
  scope            text not null check (scope in ('department', 'class')),
  department_id    uuid references public.departments(id) on delete set null,
  class_id         uuid references public.classes(id) on delete set null,
  name             text not null,
  allocated_amount integer not null default 0 check (allocated_amount >= 0),
  note             text,
  created_by       uuid references public.profiles(id) on delete set null,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),

  constraint budget_lines_scope_target check (
    (scope = 'department' and department_id is not null and class_id is null)
    or (scope = 'class' and class_id is not null and department_id is null)
  )
);

create index budget_lines_school_year_idx on public.budget_lines(school_id, fiscal_year);
create trigger budget_lines_touch before update on public.budget_lines
  for each row execute function public.touch_updated_at();

create table public.budget_expenses (
  id            uuid primary key default gen_random_uuid(),
  school_id     uuid not null references public.schools(id) on delete cascade,
  budget_line_id uuid not null references public.budget_lines(id) on delete cascade,
  requested_by  uuid references public.profiles(id) on delete set null,
  amount        integer not null check (amount > 0),
  description   text not null,
  spent_on      date not null default current_date,
  status        text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  receipt_path  text,
  reviewed_by   uuid references public.profiles(id) on delete set null,
  reviewed_at   timestamptz,
  reject_reason text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create index budget_expenses_line_idx on public.budget_expenses(budget_line_id);
create index budget_expenses_school_status_idx on public.budget_expenses(school_id, status);
create trigger budget_expenses_touch before update on public.budget_expenses
  for each row execute function public.touch_updated_at();

-- =============================================================================
-- RLS
-- =============================================================================
alter table public.budget_lines    enable row level security;
alter table public.budget_expenses enable row level security;

-- 예산 항목(배정): 조회는 같은 학교 전체, 배정 자체(항목 만들기·금액 조정)는 관리자만
create policy budget_lines_select on public.budget_lines for select
  using (public.same_school(school_id));
create policy budget_lines_write on public.budget_lines for all
  using (public.same_school(school_id) and public.is_admin())
  with check (public.same_school(school_id) and public.is_admin());

-- 지출 신청: 조회는 같은 학교 전체 (예산 집행은 민감정보가 아니라 서로
-- 알아야 투명하게 운영된다). 신청은 누구나. 신청자 본인은 대기중일 때만
-- 고치거나 지울 수 있고, 승인·반려는 관리자만 한다.
create policy budget_expenses_select on public.budget_expenses for select
  using (public.same_school(school_id));

create policy budget_expenses_insert on public.budget_expenses for insert
  with check (public.same_school(school_id) and requested_by = auth.uid());

create policy budget_expenses_update_owner on public.budget_expenses for update
  using (public.same_school(school_id) and requested_by = auth.uid() and status = 'pending')
  with check (public.same_school(school_id) and requested_by = auth.uid());

create policy budget_expenses_update_admin on public.budget_expenses for update
  using (public.same_school(school_id) and public.is_admin())
  with check (public.same_school(school_id) and public.is_admin());

create policy budget_expenses_delete_owner on public.budget_expenses for delete
  using (public.same_school(school_id) and requested_by = auth.uid() and status = 'pending');
create policy budget_expenses_delete_admin on public.budget_expenses for delete
  using (public.same_school(school_id) and public.is_admin());

-- =============================================================================
-- Realtime — 결재 대기 중인 지출이 다른 사람 화면에도 바로 뜨게
-- =============================================================================
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'budget_expenses'
  ) then
    alter publication supabase_realtime add table public.budget_expenses;
  end if;
end $$;

-- =============================================================================
-- Storage — 영수증 첨부
--
-- 버킷을 비공개로 두고, storage.objects 에 RLS 를 건다. 업로드 경로는
-- "{school_id}/{expense_id}/{파일명}" 규칙을 쓰므로, 경로 첫 조각을
-- 학교 id 와 비교하는 것만으로 다른 학교 파일에 접근을 막을 수 있다.
-- =============================================================================
insert into storage.buckets (id, name, public)
values ('receipts', 'receipts', false)
on conflict (id) do nothing;

drop policy if exists receipts_select on storage.objects;
drop policy if exists receipts_insert on storage.objects;
drop policy if exists receipts_delete on storage.objects;

create policy receipts_select on storage.objects for select
  using (
    bucket_id = 'receipts'
    and (storage.foldername(name))[1] = public.current_school_id()::text
  );

create policy receipts_insert on storage.objects for insert
  with check (
    bucket_id = 'receipts'
    and (storage.foldername(name))[1] = public.current_school_id()::text
  );

create policy receipts_delete on storage.objects for delete
  using (
    bucket_id = 'receipts'
    and (storage.foldername(name))[1] = public.current_school_id()::text
    and public.is_admin()
  );


-- ─────────────────────────────────────────────────────────────────────────────
-- 0009_pbs.sql
-- ─────────────────────────────────────────────────────────────────────────────

-- =============================================================================
-- 0009_pbs — 긍정적 행동지원(PBS) 간소화 기록 (Phase 3)
--
-- "학생 지원" 카테고리는 이미 student_sensitive 등급이 걸려 있어
-- (lib/security/sensitivity.ts) 진입 경고·상시 배너가 레이아웃에서
-- 자동으로 붙는다. 여기서는 데이터만 설계한다.
--
-- 핵심은 "학생 + 행동유형"만 고르면 한 번에 기록되는 것이다. ABC(선행
-- 사건·결과)와 메모는 나중에 펼쳐서 적는 선택 항목이고, 자유 텍스트라
-- 개인정보가 섞여 들어갈 수 있어 서버에서 AES-256-GCM으로 암호화해
-- 저장한다(lib/security/crypto.ts — 이미 Gemini 키 암호화에 쓰던
-- 범용 함수를 그대로 재사용).
-- =============================================================================

create table public.behavior_categories (
  id         uuid primary key default gen_random_uuid(),
  school_id  uuid not null references public.schools(id) on delete cascade,
  name       text not null,
  sort_order smallint not null default 0,
  is_active  boolean not null default true,
  created_at timestamptz not null default now(),
  unique (school_id, name)
);

create table public.pbs_records (
  id              uuid primary key default gen_random_uuid(),
  school_id       uuid not null references public.schools(id) on delete cascade,
  student_id      uuid not null references public.students(id) on delete cascade,
  category_id     uuid references public.behavior_categories(id) on delete set null,
  occurred_at     timestamptz not null default now(),
  location        text,
  antecedent_enc  text,
  consequence_enc text,
  note_enc        text,
  recorded_by     uuid references public.profiles(id) on delete set null,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create index pbs_records_student_idx on public.pbs_records(school_id, student_id, occurred_at desc);
create index pbs_records_school_time_idx on public.pbs_records(school_id, occurred_at desc);

create trigger pbs_records_touch before update on public.pbs_records
  for each row execute function public.touch_updated_at();

-- =============================================================================
-- RLS
-- =============================================================================
alter table public.behavior_categories enable row level security;
alter table public.pbs_records         enable row level security;

create policy behavior_categories_select on public.behavior_categories for select
  using (public.same_school(school_id));
create policy behavior_categories_write on public.behavior_categories for all
  using (public.same_school(school_id) and public.is_admin())
  with check (public.same_school(school_id) and public.is_admin());

-- 조회는 같은 학교 교직원 전체 — 학생 지원 구역 진입 경고·감사로그가
-- 이미 접근을 걸러내고 기록을 남긴다. 작성은 누구나, 수정·삭제는
-- 작성자 본인 또는 관리자만.
create policy pbs_records_select on public.pbs_records for select
  using (public.same_school(school_id));
create policy pbs_records_insert on public.pbs_records for insert
  with check (public.same_school(school_id) and recorded_by = auth.uid());
create policy pbs_records_update on public.pbs_records for update
  using (public.same_school(school_id) and (recorded_by = auth.uid() or public.is_admin()))
  with check (public.same_school(school_id));
create policy pbs_records_delete on public.pbs_records for delete
  using (public.same_school(school_id) and (recorded_by = auth.uid() or public.is_admin()));

-- =============================================================================
-- Realtime
-- =============================================================================
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'pbs_records'
  ) then
    alter publication supabase_realtime add table public.pbs_records;
  end if;
end $$;


-- ─────────────────────────────────────────────────────────────────────────────
-- 0010_notifications.sql
-- ─────────────────────────────────────────────────────────────────────────────

-- =============================================================================
-- 0010_notifications — 앱 안 알림
--
-- 결보강 배정, 특별실 예약 승인·반려, 지출 승인·반려가 나면 당사자가
-- 앱에 직접 들어와 봐야만 알 수 있던 문제를 푼다. 웹푸시·이메일까지는
-- 이번에 안 붙였다 — VAPID 키·서비스워커·구독 관리가 또 한 덩어리라
-- 범위를 나눴다. 앱 안 알림(벨 아이콘)만 우선 만든다.
--
-- 쓰기는 서버(service role)만 한다 — audit_logs·ai_usage_logs 와 같은
-- 이유로, 사용자가 자기 알림을 조작하지 못하게 막는다. 읽음 표시만
-- 본인이 직접 할 수 있게 연다.
-- =============================================================================

create table public.notifications (
  id         uuid primary key default gen_random_uuid(),
  school_id  uuid not null references public.schools(id) on delete cascade,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  title      text not null,
  body       text,
  link       text,
  read_at    timestamptz,
  created_at timestamptz not null default now()
);

create index notifications_profile_idx on public.notifications(profile_id, created_at desc);

alter table public.notifications enable row level security;

create policy notifications_select_own on public.notifications for select
  using (profile_id = auth.uid());

create policy notifications_update_own on public.notifications for update
  using (profile_id = auth.uid())
  with check (profile_id = auth.uid());

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'notifications'
  ) then
    alter publication supabase_realtime add table public.notifications;
  end if;
end $$;


-- ─────────────────────────────────────────────────────────────────────────────
-- 0011_safety.sql
-- ─────────────────────────────────────────────────────────────────────────────

-- =============================================================================
-- 0011_safety — 학생 안전 프로토콜 카드
--
-- 발작·알레르기·연하곤란처럼 응급 시 즉시 확인해야 하는 대응 절차를
-- 담임 개인 기억이나 종이 대신 앱에서 바로 찾을 수 있게 한다. "학생
-- 지원" 카테고리라 student_sensitive 등급이 자동으로 걸린다
-- (lib/security/sensitivity.ts) — 진입 경고·상시 배너는 이미 있는
-- 인프라를 그대로 탄다.
--
-- 대응 절차 본문은 자유 텍스트고 의료 정보라 PBS 기록과 같은 방식으로
-- 암호화해 저장한다(lib/security/crypto.ts). 응급 상황에 빨리 찾아야
-- 하므로 조회 자체는 학교 교직원 전체에게 열어 둔다 — 대신 작성·수정은
-- 정확성을 위해 관리자만 가능하게 한다.
-- =============================================================================

create table public.safety_protocols (
  id          uuid primary key default gen_random_uuid(),
  school_id   uuid not null references public.schools(id) on delete cascade,
  student_id  uuid not null references public.students(id) on delete cascade,
  category    text not null check (category in ('seizure', 'allergy', 'dysphagia', 'other')),
  title       text not null,
  content_enc text not null,
  created_by  uuid references public.profiles(id) on delete set null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index safety_protocols_student_idx on public.safety_protocols(school_id, student_id);

create trigger safety_protocols_touch before update on public.safety_protocols
  for each row execute function public.touch_updated_at();

alter table public.safety_protocols enable row level security;

create policy safety_protocols_select on public.safety_protocols for select
  using (public.same_school(school_id));

create policy safety_protocols_write on public.safety_protocols for all
  using (public.same_school(school_id) and public.is_admin())
  with check (public.same_school(school_id) and public.is_admin());
