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
