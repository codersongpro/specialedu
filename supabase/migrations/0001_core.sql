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
