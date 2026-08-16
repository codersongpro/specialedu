-- 특별실 예약과 예산 지출은 승인·반려 없이 등록 즉시 반영한다.

update public.rooms
set requires_approval = false
where requires_approval = true;

update public.room_reservations
set status = 'approved',
    approved_by = null,
    approved_at = null,
    reject_reason = null
where status = 'pending';

update public.budget_expenses
set status = 'approved',
    reviewed_by = null,
    reviewed_at = null,
    reject_reason = null
where status = 'pending';

alter table public.budget_expenses
  alter column status set default 'approved';

drop policy if exists budget_expenses_delete_owner on public.budget_expenses;
create policy budget_expenses_delete_owner on public.budget_expenses for delete
  using (public.same_school(school_id) and requested_by = auth.uid());
