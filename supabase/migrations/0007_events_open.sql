-- =============================================================================
-- 0007_events_open — 학사일정·행사 등록을 모든 교직원에게 연다
--
-- 예전에는 담임인 학급 행사만 넣을 수 있고, 전교·과정·학년 단위는 관리자만
-- 넣을 수 있었다. 결재나 승인 단계가 있던 것은 아니고 그냥 RLS 로 막혀
-- 있었을 뿐인데, 화면에는 "등록할 수 없습니다"로만 보여 승인이 필요한
-- 것처럼 느껴졌다. 일정은 민감정보가 아니고 서로 알아야 협업이 되는
-- 정보라, 같은 학교 교직원이면 범위에 상관없이 바로 등록하게 연다.
--
-- 두 개였던 insert 정책(관리자용·담임용)을 하나로 합친다.
-- =============================================================================

drop policy if exists events_insert_admin on public.academic_events;
drop policy if exists events_insert_class on public.academic_events;

create policy events_insert on public.academic_events for insert
  with check (public.same_school(school_id));
