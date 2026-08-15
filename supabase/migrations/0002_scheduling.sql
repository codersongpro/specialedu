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
