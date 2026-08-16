-- =============================================================================
-- 0012_iep — IEP(개별화교육계획) 목표·진도 관리
--
-- "학생 지원" 카테고리라 student_sensitive 등급이 자동으로 걸린다
-- (lib/security/sensitivity.ts) — 진입 경고·상시 배너·짧은 세션 타임아웃은
-- 이미 있는 인프라를 그대로 탄다.
--
-- PBS(0009_pbs.sql)와 같은 모양: 목표(iep_goals) 하나에 진도 기록
-- (iep_progress) 여러 건이 달린다. 진도 메모는 자유 텍스트라 개인정보가
-- 섞여 들어갈 수 있어 PBS·안전 프로토콜과 같은 방식으로 암호화해
-- 저장한다(lib/security/crypto.ts).
--
-- 조회는 학교 교직원 전체 — 담임이 아니어도 협력수업·치료지원 교사가
-- 같은 학생의 목표를 봐야 한다(안전 프로토콜만큼 "누구나 응급으로 봐야"
-- 하는 성격은 아니라서 school-wide select 는 유지하되, 쓰기는 PBS처럼
-- 작성자 본인 또는 관리자로 좁힌다 — 목표는 안전 프로토콜보다는 개인
-- 기록에 가깝다).
-- =============================================================================

create table public.iep_goals (
  id          uuid primary key default gen_random_uuid(),
  school_id   uuid not null references public.schools(id) on delete cascade,
  student_id  uuid not null references public.students(id) on delete cascade,
  area        text not null check (area in ('self_care', 'communication', 'academic', 'social', 'motor', 'other')),
  title       text not null,
  term_label  text not null,
  status      text not null default 'active' check (status in ('active', 'achieved', 'discontinued')),
  created_by  uuid references public.profiles(id) on delete set null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index iep_goals_student_idx on public.iep_goals(school_id, student_id);

create trigger iep_goals_touch before update on public.iep_goals
  for each row execute function public.touch_updated_at();

create table public.iep_progress (
  id          uuid primary key default gen_random_uuid(),
  school_id   uuid not null references public.schools(id) on delete cascade,
  goal_id     uuid not null references public.iep_goals(id) on delete cascade,
  occurred_on date not null default current_date,
  level       text not null check (level in ('independent', 'partial_help', 'full_help', 'not_yet')),
  note_enc    text,
  recorded_by uuid references public.profiles(id) on delete set null,
  created_at  timestamptz not null default now()
);

create index iep_progress_goal_idx on public.iep_progress(school_id, goal_id, occurred_on desc);

-- =============================================================================
-- RLS
-- =============================================================================
alter table public.iep_goals    enable row level security;
alter table public.iep_progress enable row level security;

create policy iep_goals_select on public.iep_goals for select
  using (public.same_school(school_id));
create policy iep_goals_insert on public.iep_goals for insert
  with check (public.same_school(school_id) and created_by = auth.uid());
create policy iep_goals_update on public.iep_goals for update
  using (public.same_school(school_id) and (created_by = auth.uid() or public.is_admin()))
  with check (public.same_school(school_id));
create policy iep_goals_delete on public.iep_goals for delete
  using (public.same_school(school_id) and (created_by = auth.uid() or public.is_admin()));

create policy iep_progress_select on public.iep_progress for select
  using (public.same_school(school_id));
create policy iep_progress_insert on public.iep_progress for insert
  with check (public.same_school(school_id) and recorded_by = auth.uid());
create policy iep_progress_update on public.iep_progress for update
  using (public.same_school(school_id) and (recorded_by = auth.uid() or public.is_admin()))
  with check (public.same_school(school_id));
create policy iep_progress_delete on public.iep_progress for delete
  using (public.same_school(school_id) and (recorded_by = auth.uid() or public.is_admin()));
