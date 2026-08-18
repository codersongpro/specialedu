-- =============================================================================
-- 0017_equipment — 교구·보조공학기기 대여 관리
--
-- 특별실 예약(0002_scheduling.sql)과 다른 점 두 가지: "장소"가 아니라
-- "물건"이고, 같은 물건이 여러 대(수량) 있을 수 있다. 보유 수량 안에서는
-- 여러 명이 겹치는 기간에 동시에 빌릴 수 있어야 하므로, 방 예약이 쓰는
-- GIST exclude(겹침 자체를 막음)로는 표현이 안 된다 — "N대 중 몇 대가
-- 겹치는지"를 세야 한다. 그래서 트리거로 겹치는 대여의 수량 합이 보유
-- 수량을 넘으면 막는다. 방식은 다르지만 "서버가 재계산해서 강제한다"는
-- fill_period_minutes()·room_no_double_booking과 같은 원칙이다.
--
-- 승인 절차는 두지 않는다 — 0015_direct_registration.sql로 이미 정한
-- "직접 등록" 방침과 일관되게, 대여도 등록 즉시 확정된다.
--
-- 대여는 교시가 아니라 날짜(며칠) 단위다 — 태블릿·보행기 같은 교구는
-- 하루 종일, 며칠씩 빌려 쓰는 게 보통이라 periods 시정표와 맞지 않는다.
-- =============================================================================

create table if not exists public.equipment_items (
  id             uuid primary key default gen_random_uuid(),
  school_id      uuid not null references public.schools(id) on delete cascade,
  name           text not null,
  category       text not null default 'general',
  total_quantity smallint not null check (total_quantity > 0),
  note           text,
  is_active      boolean not null default true,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  unique (school_id, name)
);

create index if not exists equipment_items_school_idx on public.equipment_items(school_id) where is_active;
create or replace trigger equipment_items_touch before update on public.equipment_items
  for each row execute function public.touch_updated_at();

create table if not exists public.equipment_loans (
  id          uuid primary key default gen_random_uuid(),
  school_id   uuid not null references public.schools(id) on delete cascade,
  item_id     uuid not null references public.equipment_items(id) on delete cascade,
  quantity    smallint not null check (quantity > 0),
  borrower_id uuid not null references public.profiles(id) on delete cascade,
  class_id    uuid references public.classes(id) on delete set null,
  starts_on   date not null,
  ends_on     date not null,
  purpose     text,
  returned_at timestamptz,
  created_at  timestamptz not null default now(),
  check (ends_on >= starts_on)
);

create index if not exists equipment_loans_item_idx on public.equipment_loans(item_id, starts_on, ends_on)
  where returned_at is null;
create index if not exists equipment_loans_borrower_idx on public.equipment_loans(borrower_id, starts_on);

-- -----------------------------------------------------------------------------
-- 재고 초과 대여 방지
--
-- 같은 물건에서 날짜가 겹치고 아직 반납되지 않은 대여들의 수량 합 + 이번
-- 요청 수량이 보유 수량을 넘으면 막는다. UPDATE도 검사 대상에 넣어야
-- 수량·기간을 늘리는 수정도 걸린다. returned_at을 채우는 반납 처리는
-- 자기 자신을 반납 처리하는 것이므로 항상 통과시킨다.
-- -----------------------------------------------------------------------------
create or replace function public.check_equipment_capacity()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_total smallint;
  v_used  smallint;
begin
  if new.returned_at is not null then
    return new;
  end if;

  select total_quantity into v_total
  from public.equipment_items
  where id = new.item_id;

  if v_total is null then
    raise exception '등록되지 않은 교구입니다';
  end if;

  select coalesce(sum(quantity), 0) into v_used
  from public.equipment_loans
  where item_id = new.item_id
    and id <> new.id
    and returned_at is null
    and daterange(starts_on, ends_on, '[]') && daterange(new.starts_on, new.ends_on, '[]');

  if v_used + new.quantity > v_total then
    raise exception '재고가 부족합니다 (보유 %대, 그 기간에 이미 %대 대여 중, 요청 %대)',
      v_total, v_used, new.quantity
      using errcode = 'check_violation';
  end if;

  return new;
end;
$$;

create or replace trigger equipment_loans_check_capacity
  before insert or update of item_id, quantity, starts_on, ends_on, returned_at
  on public.equipment_loans
  for each row execute function public.check_equipment_capacity();

-- =============================================================================
-- RLS
--
-- drop if exists 뒤에 create — 이 파일을 다시 실행해도(예: 앞부분에서
-- 한 번 걸려 중단됐던 걸 이어서 돌리는 경우) 안전하게 끝까지 통과한다.
-- =============================================================================
alter table public.equipment_items enable row level security;
alter table public.equipment_loans enable row level security;

-- 품목: 조회는 같은 학교 전체, 등록·수정은 관리자만 (rooms 패턴과 동일).
drop policy if exists equipment_items_select on public.equipment_items;
create policy equipment_items_select on public.equipment_items for select
  using (public.same_school(school_id));
drop policy if exists equipment_items_write on public.equipment_items;
create policy equipment_items_write on public.equipment_items for all
  using (public.same_school(school_id) and public.is_admin())
  with check (public.same_school(school_id) and public.is_admin());

-- 대여: 조회는 같은 학교 전체, 생성·수정(반납 처리)·취소는 본인 또는
-- 관리자만 (room_reservations 패턴과 동일).
drop policy if exists equipment_loans_select on public.equipment_loans;
create policy equipment_loans_select on public.equipment_loans for select
  using (public.same_school(school_id));
drop policy if exists equipment_loans_insert on public.equipment_loans;
create policy equipment_loans_insert on public.equipment_loans for insert
  with check (public.same_school(school_id) and (borrower_id = auth.uid() or public.is_admin()));
drop policy if exists equipment_loans_update on public.equipment_loans;
create policy equipment_loans_update on public.equipment_loans for update
  using (public.same_school(school_id) and (borrower_id = auth.uid() or public.is_admin()));
drop policy if exists equipment_loans_delete on public.equipment_loans;
create policy equipment_loans_delete on public.equipment_loans for delete
  using (public.same_school(school_id) and (borrower_id = auth.uid() or public.is_admin()));

-- =============================================================================
-- Realtime — 여러 사람이 동시에 봐도 대여 현황이 바로 반영되게
-- =============================================================================
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    if not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'equipment_items'
    ) then
      alter publication supabase_realtime add table public.equipment_items;
    end if;
    if not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'equipment_loans'
    ) then
      alter publication supabase_realtime add table public.equipment_loans;
    end if;
  end if;
end $$;
