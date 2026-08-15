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
