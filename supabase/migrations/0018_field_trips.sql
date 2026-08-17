-- =============================================================================
-- 0018_field_trips — 현장체험학습 계획·안전점검
--
-- academic_events(0004_calendar.sql)와 별도 테이블로 둔다. 캘린더
-- 화면(app/(app)/calendar/page.tsx)이 이미 room_reservations를
-- kind:'reservation' 합성 이벤트로 캘린더 피드에 섞어 보여주는 선례가
-- 있어, 체험학습도 같은 방식으로 얹으면 event_category enum을 건드리지
-- 않고도 캘린더에 자연스럽게 나타난다 — 체험학습은 체크리스트·인솔
-- 배치처럼 academic_events에 없는 구조가 필요해 애초에 같은 테이블에
-- 넣기 어렵다.
--
-- scope_* 컬럼과 체크 제약은 academic_events와 완전히 같은 모양이다
-- (재사용 목적 — 캘린더 필터 로직을 그대로 적용할 수 있다).
--
-- 승인 절차는 두지 않는다 — academic_events가 0007_events_open.sql로
-- 이미 "같은 학교 교직원이면 누구나 등록" 방침으로 바뀌었고, 체험학습도
-- 학사일정과 같은 성격의 일정 정보라 같은 방침을 따른다.
--
-- 비상연락 체계: students 테이블에는 가명처리 원칙상 연락처 컬럼이
-- 없다(0001_core.sql). 그래서 여기서도 학생 연락처를 저장하지 않고,
-- "담임을 통해 연락한다" 같은 절차를 적는 자유 텍스트(contact_note)로만
-- 다룬다.
-- =============================================================================

create table public.field_trips (
  id          uuid primary key default gen_random_uuid(),
  school_id   uuid not null references public.schools(id) on delete cascade,
  title       text not null,
  destination text,
  starts_on   date not null,
  ends_on     date not null,

  scope                event_scope not null default 'school',
  scope_course         course_level,
  scope_grade          smallint,
  scope_class_id       uuid references public.classes(id) on delete cascade,
  scope_department_id  uuid references public.departments(id) on delete cascade,

  -- 비상연락 안내 — 예: "인솔 담임을 통해 학부모에게 연락"
  contact_note text,

  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  check (ends_on >= starts_on),
  constraint field_trip_scope_ref_matches check (
    case scope
      when 'course'     then scope_course is not null
      when 'grade'      then scope_course is not null and scope_grade is not null
      when 'class'      then scope_class_id is not null
      when 'department' then scope_department_id is not null
      else true
    end
  )
);

create trigger field_trips_touch before update on public.field_trips
  for each row execute function public.touch_updated_at();

create index field_trips_range_idx on public.field_trips(school_id, starts_on, ends_on);

-- -----------------------------------------------------------------------------
-- 안전 점검 체크리스트 — 건마다 자유롭게 추가하는 단순 목록.
-- 재사용 템플릿은 두지 않는다(요청받은 범위를 넘어서는 과설계).
-- -----------------------------------------------------------------------------
create table public.field_trip_checklist_items (
  id         uuid primary key default gen_random_uuid(),
  school_id  uuid not null references public.schools(id) on delete cascade,
  trip_id    uuid not null references public.field_trips(id) on delete cascade,
  label      text not null,
  is_checked boolean not null default false,
  checked_by uuid references public.profiles(id) on delete set null,
  checked_at timestamptz,
  created_at timestamptz not null default now()
);

create index field_trip_checklist_trip_idx on public.field_trip_checklist_items(trip_id);

-- -----------------------------------------------------------------------------
-- 인솔 배치 — 이 체험학습에 배정된 교직원.
-- -----------------------------------------------------------------------------
create table public.field_trip_chaperones (
  id         uuid primary key default gen_random_uuid(),
  school_id  uuid not null references public.schools(id) on delete cascade,
  trip_id    uuid not null references public.field_trips(id) on delete cascade,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  note       text,
  created_at timestamptz not null default now(),
  unique (trip_id, profile_id)
);

create index field_trip_chaperones_trip_idx on public.field_trip_chaperones(trip_id);

-- =============================================================================
-- RLS
--
-- 조회는 같은 학교 전체(academic_events와 동일). 쓰기는 체험학습을 만든
-- 사람 또는 관리자만(academic_events의 events_update/events_delete와
-- 동일 원칙). 체크리스트·인솔 배치도 그 체험학습을 만든 사람 또는
-- 관리자만 건드릴 수 있다.
-- =============================================================================
alter table public.field_trips               enable row level security;
alter table public.field_trip_checklist_items enable row level security;
alter table public.field_trip_chaperones      enable row level security;

create policy field_trips_select on public.field_trips for select
  using (public.same_school(school_id));
create policy field_trips_insert on public.field_trips for insert
  with check (public.same_school(school_id));
create policy field_trips_update on public.field_trips for update
  using (public.same_school(school_id) and (public.is_admin() or created_by = auth.uid()));
create policy field_trips_delete on public.field_trips for delete
  using (public.same_school(school_id) and (public.is_admin() or created_by = auth.uid()));

create policy field_trip_checklist_select on public.field_trip_checklist_items for select
  using (public.same_school(school_id));
create policy field_trip_checklist_write on public.field_trip_checklist_items for all
  using (
    public.same_school(school_id)
    and (
      public.is_admin()
      or exists (select 1 from public.field_trips t where t.id = trip_id and t.created_by = auth.uid())
    )
  )
  with check (
    public.same_school(school_id)
    and (
      public.is_admin()
      or exists (select 1 from public.field_trips t where t.id = trip_id and t.created_by = auth.uid())
    )
  );

create policy field_trip_chaperones_select on public.field_trip_chaperones for select
  using (public.same_school(school_id));
create policy field_trip_chaperones_write on public.field_trip_chaperones for all
  using (
    public.same_school(school_id)
    and (
      public.is_admin()
      or exists (select 1 from public.field_trips t where t.id = trip_id and t.created_by = auth.uid())
    )
  )
  with check (
    public.same_school(school_id)
    and (
      public.is_admin()
      or exists (select 1 from public.field_trips t where t.id = trip_id and t.created_by = auth.uid())
    )
  );

-- =============================================================================
-- Realtime
-- =============================================================================
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    alter publication supabase_realtime add table public.field_trips;
    alter publication supabase_realtime add table public.field_trip_checklist_items;
    alter publication supabase_realtime add table public.field_trip_chaperones;
  end if;
end $$;
