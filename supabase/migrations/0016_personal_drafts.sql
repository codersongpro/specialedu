create table public.personal_drafts (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete cascade,
  owner_id uuid not null references public.profiles(id) on delete cascade,
  tool text not null check (tool in ('lesson_adapt', 'video_kit')),
  title text not null check (char_length(title) between 1 and 120),
  content text not null,
  meta jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index personal_drafts_owner_updated_idx on public.personal_drafts(owner_id, updated_at desc);
create trigger personal_drafts_touch before update on public.personal_drafts
  for each row execute function public.touch_updated_at();

alter table public.personal_drafts enable row level security;

create policy personal_drafts_owner_select on public.personal_drafts for select
  using (owner_id = auth.uid() and public.same_school(school_id));
create policy personal_drafts_owner_insert on public.personal_drafts for insert
  with check (owner_id = auth.uid() and public.same_school(school_id));
create policy personal_drafts_owner_update on public.personal_drafts for update
  using (owner_id = auth.uid() and public.same_school(school_id))
  with check (owner_id = auth.uid() and public.same_school(school_id));
create policy personal_drafts_owner_delete on public.personal_drafts for delete
  using (owner_id = auth.uid() and public.same_school(school_id));
