create type public.equipment_condition as enum ('available', 'repair', 'retired');

create table public.equipment_items (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete cascade,
  name text not null,
  category text,
  location text,
  total_quantity integer not null check (total_quantity > 0),
  condition public.equipment_condition not null default 'available',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (school_id, name)
);

create table public.equipment_loans (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete cascade,
  item_id uuid not null references public.equipment_items(id) on delete restrict,
  borrower_id uuid not null references public.profiles(id) on delete restrict,
  quantity integer not null check (quantity > 0),
  due_on date,
  returned_at timestamptz,
  note text check (char_length(note) <= 300),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index equipment_items_school_idx on public.equipment_items(school_id, name);
create index equipment_loans_open_item_idx on public.equipment_loans(item_id) where returned_at is null;
create index equipment_loans_borrower_idx on public.equipment_loans(borrower_id, returned_at);

create trigger equipment_items_touch before update on public.equipment_items
  for each row execute function public.touch_updated_at();
create trigger equipment_loans_touch before update on public.equipment_loans
  for each row execute function public.touch_updated_at();

create or replace function public.guard_equipment_loan()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_quantity integer;
  v_condition public.equipment_condition;
  v_borrower_school uuid;
  v_open_quantity integer;
begin
  if tg_op = 'UPDATE' and (new.item_id is distinct from old.item_id or new.borrower_id is distinct from old.borrower_id or new.school_id is distinct from old.school_id) then
    raise exception '대여 교구와 대여자는 바꿀 수 없습니다';
  end if;

  select total_quantity, condition into v_quantity, v_condition
  from public.equipment_items
  where id = new.item_id and school_id = new.school_id
  for update;

  if not found then
    raise exception '학교에 등록된 교구만 대여할 수 있습니다';
  end if;

  select school_id into v_borrower_school from public.profiles where id = new.borrower_id and is_active;
  if v_borrower_school is distinct from new.school_id then
    raise exception '같은 학교의 재직 교직원만 대여할 수 있습니다';
  end if;

  if new.returned_at is null then
    if v_condition <> 'available' then
      raise exception '현재 대여할 수 없는 교구입니다';
    end if;

    select coalesce(sum(quantity), 0) into v_open_quantity
    from public.equipment_loans
    where item_id = new.item_id and returned_at is null and id is distinct from new.id;

    if v_open_quantity + new.quantity > v_quantity then
      raise exception '대여 가능한 수량이 부족합니다';
    end if;
  end if;

  return new;
end;
$$;

create trigger equipment_loans_guard before insert or update on public.equipment_loans
  for each row execute function public.guard_equipment_loan();

revoke execute on function public.guard_equipment_loan() from public, anon, authenticated, service_role;

alter table public.equipment_items enable row level security;
alter table public.equipment_loans enable row level security;

create policy equipment_items_select_school on public.equipment_items for select
  using (public.same_school(school_id));
create policy equipment_items_manage_admin on public.equipment_items for all
  using (public.same_school(school_id) and public.is_admin())
  with check (public.same_school(school_id) and public.is_admin());

create policy equipment_loans_select_school on public.equipment_loans for select
  using (public.same_school(school_id));
create policy equipment_loans_insert_own on public.equipment_loans for insert
  with check (public.same_school(school_id) and borrower_id = auth.uid());
create policy equipment_loans_update_own on public.equipment_loans for update
  using (public.same_school(school_id) and borrower_id = auth.uid())
  with check (public.same_school(school_id) and borrower_id = auth.uid());
create policy equipment_loans_manage_admin on public.equipment_loans for all
  using (public.same_school(school_id) and public.is_admin())
  with check (public.same_school(school_id) and public.is_admin());
