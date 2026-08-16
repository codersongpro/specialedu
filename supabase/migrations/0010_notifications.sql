-- =============================================================================
-- 0010_notifications — 앱 안 알림
--
-- 결보강 배정, 특별실 예약 승인·반려, 지출 승인·반려가 나면 당사자가
-- 앱에 직접 들어와 봐야만 알 수 있던 문제를 푼다. 웹푸시·이메일까지는
-- 이번에 안 붙였다 — VAPID 키·서비스워커·구독 관리가 또 한 덩어리라
-- 범위를 나눴다. 앱 안 알림(벨 아이콘)만 우선 만든다.
--
-- 쓰기는 서버(service role)만 한다 — audit_logs·ai_usage_logs 와 같은
-- 이유로, 사용자가 자기 알림을 조작하지 못하게 막는다. 읽음 표시만
-- 본인이 직접 할 수 있게 연다.
-- =============================================================================

create table public.notifications (
  id         uuid primary key default gen_random_uuid(),
  school_id  uuid not null references public.schools(id) on delete cascade,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  title      text not null,
  body       text,
  link       text,
  read_at    timestamptz,
  created_at timestamptz not null default now()
);

create index notifications_profile_idx on public.notifications(profile_id, created_at desc);

alter table public.notifications enable row level security;

create policy notifications_select_own on public.notifications for select
  using (profile_id = auth.uid());

create policy notifications_update_own on public.notifications for update
  using (profile_id = auth.uid())
  with check (profile_id = auth.uid());

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'notifications'
  ) then
    alter publication supabase_realtime add table public.notifications;
  end if;
end $$;
