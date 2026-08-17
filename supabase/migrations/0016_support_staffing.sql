-- =============================================================================
-- 0016_support_staffing — 보조인력(실무사·사회복무요원) 배치
--
-- 특수학교는 학급마다 보조인력의 도움이 필요한 시간대가 다르고, 보조인력은
-- 전일 근무가 아닌 경우가 많다. 지금까지는 이 배치를 종이나 엑셀로 맞춰
-- 왔는데, "아무도 안 들어가는 시간"과 "한 사람이 두 곳에 걸린 시간"을
-- 사람이 눈으로 찾아야 해서 학기 초마다 사고가 난다.
--
-- 설계 판단 — 이 파일은 **막지 않고 경고한다**:
-- 이 저장소는 이중예약을 GIST exclude 제약으로 원천 차단하는 패턴을 세 곳
-- (timetable_slots·room_reservations·substitution_assignments)에서 쓴다.
-- 하지만 보조인력 배치는 "공백·중복을 화면에 보여주는" 것이 기능의 목적
-- 자체다. DB가 중복 배치를 거부해 버리면 보여줄 상태가 아예 만들어지지
-- 않는다. 그래서 판정은 순수 함수(lib/staffing/coverage.ts)로 하고,
-- support_assignments 에는 일부러 겹침 제약을 걸지 않는다.
--
-- 반대로 support_availability(한 사람의 근무 가능 시간)에 겹치는 구간이
-- 들어가는 건 경고 대상이 아니라 명백한 입력 실수라 exclude 로 막는다.
--
-- RLS 는 safety_protocols(0011)와 같은 모양이다 — 조회는 같은 학교 전체
-- (보조인력 본인도 자기 배치를 봐야 한다), 쓰기는 관리자만.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 지원 필요 시간 — "이 학급은 이 요일 이 교시에 보조인력이 필요하다"
--
-- timetable_slots 와 같이 course 를 비정규화해 두고 fill_period_minutes()
-- 트리거로 교시 번호 → 실제 분을 채운다. 과정마다 시정이 달라(초등 3교시와
-- 고등 3교시는 다른 시각) 교시 번호만으로 비교하면 겹침을 놓치기 때문이다.
-- 클라이언트가 보낸 시각은 믿지 않는다.
-- -----------------------------------------------------------------------------
create table public.support_needs (
  id          uuid primary key default gen_random_uuid(),
  school_id   uuid not null references public.schools(id) on delete cascade,
  term_id     uuid not null references public.terms(id) on delete cascade,
  class_id    uuid not null references public.classes(id) on delete cascade,
  course      course_level not null,
  day_of_week smallint not null check (day_of_week between 1 and 7),
  period_no   smallint not null,
  starts_min  smallint not null default 0,
  ends_min    smallint not null default 0,
  note        text,
  created_by  uuid references public.profiles(id) on delete set null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),

  constraint support_needs_unique unique (term_id, class_id, day_of_week, period_no)
);

create trigger support_needs_fill_minutes
  before insert or update of course, period_no, school_id on public.support_needs
  for each row execute function public.fill_period_minutes();

create trigger support_needs_touch before update on public.support_needs
  for each row execute function public.touch_updated_at();

create index support_needs_term_idx on public.support_needs(term_id, day_of_week);

-- -----------------------------------------------------------------------------
-- 근무 가능 시간 — "이 보조인력은 이 요일 이 시간대에 근무한다"
--
-- 교시가 아니라 시각 범위다. 보조인력 근무시간(예: 09:00~13:00)은 교시
-- 경계와 맞아떨어지지 않는다. profiles.work_days 는 요일 단위라 이걸
-- 표현할 수 없어 별도 테이블이 필요하다.
-- -----------------------------------------------------------------------------
create table public.support_availability (
  id          uuid primary key default gen_random_uuid(),
  school_id   uuid not null references public.schools(id) on delete cascade,
  profile_id  uuid not null references public.profiles(id) on delete cascade,
  day_of_week smallint not null check (day_of_week between 1 and 7),
  starts_min  smallint not null check (starts_min between 0 and 1440),
  ends_min    smallint not null check (ends_min between 0 and 1440),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),

  constraint support_availability_span check (ends_min > starts_min)
);

create trigger support_availability_touch before update on public.support_availability
  for each row execute function public.touch_updated_at();

create index support_availability_profile_idx
  on public.support_availability(school_id, profile_id, day_of_week);

-- 같은 사람의 같은 요일 근무구간이 서로 겹치는 건 입력 실수다 — 여기서 막는다.
alter table public.support_availability
  add constraint support_availability_no_overlap
  exclude using gist (
    profile_id with =,
    day_of_week with =,
    int4range(starts_min::int, ends_min::int) with &&
  );

-- -----------------------------------------------------------------------------
-- 배치 — "이 지원 필요 시간을 이 사람이 맡는다"
--
-- 겹침 제약을 일부러 걸지 않는다(파일 맨 위 설명 참고). 한 시간대에
-- 한 명만 배치하므로 need 당 한 행이고, 담당자를 바꾸는 건 update 다.
-- -----------------------------------------------------------------------------
create table public.support_assignments (
  id          uuid primary key default gen_random_uuid(),
  school_id   uuid not null references public.schools(id) on delete cascade,
  need_id     uuid not null references public.support_needs(id) on delete cascade,
  profile_id  uuid not null references public.profiles(id) on delete cascade,
  assigned_by uuid references public.profiles(id) on delete set null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),

  constraint support_assignments_one_per_need unique (need_id)
);

create trigger support_assignments_touch before update on public.support_assignments
  for each row execute function public.touch_updated_at();

create index support_assignments_profile_idx
  on public.support_assignments(school_id, profile_id);

-- -----------------------------------------------------------------------------
-- RLS — 조회는 같은 학교 전체, 쓰기는 관리자만 (safety_protocols 와 동일)
-- -----------------------------------------------------------------------------
alter table public.support_needs        enable row level security;
alter table public.support_availability enable row level security;
alter table public.support_assignments  enable row level security;

create policy support_needs_select on public.support_needs for select
  using (public.same_school(school_id));
create policy support_needs_write on public.support_needs for all
  using (public.same_school(school_id) and public.is_admin())
  with check (public.same_school(school_id) and public.is_admin());

create policy support_availability_select on public.support_availability for select
  using (public.same_school(school_id));
create policy support_availability_write on public.support_availability for all
  using (public.same_school(school_id) and public.is_admin())
  with check (public.same_school(school_id) and public.is_admin());

create policy support_assignments_select on public.support_assignments for select
  using (public.same_school(school_id));
create policy support_assignments_write on public.support_assignments for all
  using (public.same_school(school_id) and public.is_admin())
  with check (public.same_school(school_id) and public.is_admin());

-- 화면에서 다른 사람이 배치를 바꾸면 바로 보이게 한다 (기존 RealtimeRefresh 패턴)
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    alter publication supabase_realtime add table public.support_needs;
    alter publication supabase_realtime add table public.support_assignments;
  end if;
end $$;
