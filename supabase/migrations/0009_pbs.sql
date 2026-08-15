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
