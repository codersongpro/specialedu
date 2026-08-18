-- =============================================================================
-- 0020_ai_features — 가정통신문 저장 + 협의록 정리
--
-- 두 테이블 모두 easy-read(쉬운글 안내문)·PBS 진도 메모와 같은 원칙을
-- 따른다: 마스킹 왕복을 거친 뒤의 텍스트라도 실제 개인정보가 다시
-- 채워져 있을 수 있으므로, 자유 텍스트 본문은 반드시 암호화해서
-- 저장한다(`encryptSecret()`, 앱 레벨 AES-256-GCM — 이 마이그레이션은
-- 컬럼을 text로만 두고 암호화는 애플리케이션이 한다).
--
-- 조회는 같은 학교 전체(academic_events처럼 다른 교직원도 참고·재사용
-- 해야 하는 정보), 쓰기(등록·삭제)는 작성자 또는 관리자만.
-- =============================================================================

create table public.notices (
  id          uuid primary key default gen_random_uuid(),
  school_id   uuid not null references public.schools(id) on delete cascade,
  notice_type text not null,
  title       text not null,
  event_date  date,
  place       text,
  items       text[] not null default '{}',
  audience    text not null,
  level       smallint not null check (level between 1 and 3),
  -- 마스킹→Gemini→복원을 거친 뒤의 텍스트. 원문 개인정보가 남아 있을 수
  -- 있어 암호화한다(PBS note_enc와 같은 원칙).
  detail_enc  text not null,
  output_enc  text not null,
  created_by  uuid references public.profiles(id) on delete set null,
  created_at  timestamptz not null default now()
);

create index notices_school_idx on public.notices(school_id, created_at desc);

create table public.meeting_notes (
  id          uuid primary key default gen_random_uuid(),
  school_id   uuid not null references public.schools(id) on delete cascade,
  title       text not null,
  meeting_date date not null default current_date,
  category    text,
  raw_text_enc text not null,
  summary_enc  text not null,
  created_by  uuid references public.profiles(id) on delete set null,
  created_at  timestamptz not null default now()
);

create index meeting_notes_school_idx on public.meeting_notes(school_id, meeting_date desc);

-- =============================================================================
-- RLS
-- =============================================================================
alter table public.notices       enable row level security;
alter table public.meeting_notes enable row level security;

create policy notices_select on public.notices for select
  using (public.same_school(school_id));
create policy notices_insert on public.notices for insert
  with check (public.same_school(school_id) and (created_by = auth.uid() or public.is_admin()));
create policy notices_delete on public.notices for delete
  using (public.same_school(school_id) and (created_by = auth.uid() or public.is_admin()));

create policy meeting_notes_select on public.meeting_notes for select
  using (public.same_school(school_id));
create policy meeting_notes_insert on public.meeting_notes for insert
  with check (public.same_school(school_id) and (created_by = auth.uid() or public.is_admin()));
create policy meeting_notes_delete on public.meeting_notes for delete
  using (public.same_school(school_id) and (created_by = auth.uid() or public.is_admin()));

-- =============================================================================
-- Realtime
-- =============================================================================
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    if not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'notices'
    ) then
      alter publication supabase_realtime add table public.notices;
    end if;
    if not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'meeting_notes'
    ) then
      alter publication supabase_realtime add table public.meeting_notes;
    end if;
  end if;
end $$;
