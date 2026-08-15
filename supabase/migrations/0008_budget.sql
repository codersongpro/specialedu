-- =============================================================================
-- 0008_budget — 학급·부서 예산 (Phase 2)
--
-- 흐름은 "예산 항목(배정) → 지출 신청(품의) → 승인(집행 확정)" 3단계다.
-- 잔액은 별도 컬럼으로 저장하지 않는다 — 배정액에서 승인된 지출의 합을
-- 빼는 것뿐이라, 저장해 두면 동시 승인 때 어긋날 수 있는 값을 굳이
-- 만들 이유가 없다. 화면에서 매번 더해서 보여준다.
-- =============================================================================

create table public.budget_lines (
  id               uuid primary key default gen_random_uuid(),
  school_id        uuid not null references public.schools(id) on delete cascade,
  fiscal_year      integer not null default extract(year from now()),
  scope            text not null check (scope in ('department', 'class')),
  department_id    uuid references public.departments(id) on delete set null,
  class_id         uuid references public.classes(id) on delete set null,
  name             text not null,
  allocated_amount integer not null default 0 check (allocated_amount >= 0),
  note             text,
  created_by       uuid references public.profiles(id) on delete set null,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),

  constraint budget_lines_scope_target check (
    (scope = 'department' and department_id is not null and class_id is null)
    or (scope = 'class' and class_id is not null and department_id is null)
  )
);

create index budget_lines_school_year_idx on public.budget_lines(school_id, fiscal_year);
create trigger budget_lines_touch before update on public.budget_lines
  for each row execute function public.touch_updated_at();

create table public.budget_expenses (
  id            uuid primary key default gen_random_uuid(),
  school_id     uuid not null references public.schools(id) on delete cascade,
  budget_line_id uuid not null references public.budget_lines(id) on delete cascade,
  requested_by  uuid references public.profiles(id) on delete set null,
  amount        integer not null check (amount > 0),
  description   text not null,
  spent_on      date not null default current_date,
  status        text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  receipt_path  text,
  reviewed_by   uuid references public.profiles(id) on delete set null,
  reviewed_at   timestamptz,
  reject_reason text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create index budget_expenses_line_idx on public.budget_expenses(budget_line_id);
create index budget_expenses_school_status_idx on public.budget_expenses(school_id, status);
create trigger budget_expenses_touch before update on public.budget_expenses
  for each row execute function public.touch_updated_at();

-- =============================================================================
-- RLS
-- =============================================================================
alter table public.budget_lines    enable row level security;
alter table public.budget_expenses enable row level security;

-- 예산 항목(배정): 조회는 같은 학교 전체, 배정 자체(항목 만들기·금액 조정)는 관리자만
create policy budget_lines_select on public.budget_lines for select
  using (public.same_school(school_id));
create policy budget_lines_write on public.budget_lines for all
  using (public.same_school(school_id) and public.is_admin())
  with check (public.same_school(school_id) and public.is_admin());

-- 지출 신청: 조회는 같은 학교 전체 (예산 집행은 민감정보가 아니라 서로
-- 알아야 투명하게 운영된다). 신청은 누구나. 신청자 본인은 대기중일 때만
-- 고치거나 지울 수 있고, 승인·반려는 관리자만 한다.
create policy budget_expenses_select on public.budget_expenses for select
  using (public.same_school(school_id));

create policy budget_expenses_insert on public.budget_expenses for insert
  with check (public.same_school(school_id) and requested_by = auth.uid());

create policy budget_expenses_update_owner on public.budget_expenses for update
  using (public.same_school(school_id) and requested_by = auth.uid() and status = 'pending')
  with check (public.same_school(school_id) and requested_by = auth.uid());

create policy budget_expenses_update_admin on public.budget_expenses for update
  using (public.same_school(school_id) and public.is_admin())
  with check (public.same_school(school_id) and public.is_admin());

create policy budget_expenses_delete_owner on public.budget_expenses for delete
  using (public.same_school(school_id) and requested_by = auth.uid() and status = 'pending');
create policy budget_expenses_delete_admin on public.budget_expenses for delete
  using (public.same_school(school_id) and public.is_admin());

-- =============================================================================
-- Realtime — 결재 대기 중인 지출이 다른 사람 화면에도 바로 뜨게
-- =============================================================================
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'budget_expenses'
  ) then
    alter publication supabase_realtime add table public.budget_expenses;
  end if;
end $$;

-- =============================================================================
-- Storage — 영수증 첨부
--
-- 버킷을 비공개로 두고, storage.objects 에 RLS 를 건다. 업로드 경로는
-- "{school_id}/{expense_id}/{파일명}" 규칙을 쓰므로, 경로 첫 조각을
-- 학교 id 와 비교하는 것만으로 다른 학교 파일에 접근을 막을 수 있다.
-- =============================================================================
insert into storage.buckets (id, name, public)
values ('receipts', 'receipts', false)
on conflict (id) do nothing;

drop policy if exists receipts_select on storage.objects;
drop policy if exists receipts_insert on storage.objects;
drop policy if exists receipts_delete on storage.objects;

create policy receipts_select on storage.objects for select
  using (
    bucket_id = 'receipts'
    and (storage.foldername(name))[1] = public.current_school_id()::text
  );

create policy receipts_insert on storage.objects for insert
  with check (
    bucket_id = 'receipts'
    and (storage.foldername(name))[1] = public.current_school_id()::text
  );

create policy receipts_delete on storage.objects for delete
  using (
    bucket_id = 'receipts'
    and (storage.foldername(name))[1] = public.current_school_id()::text
    and public.is_admin()
  );
