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
