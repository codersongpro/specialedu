-- 공개 RPC가 필요 없는 SECURITY DEFINER 함수의 실행 권한을 제한한다.
-- RLS 정책에서 쓰는 학교·관리자 확인 함수만 인증된 사용자에게 허용한다.

alter function public.touch_updated_at() set search_path = public, pg_temp;
alter function public.same_school(uuid) set search_path = public, pg_temp;

revoke execute on function public.touch_updated_at() from public;
revoke execute on function public.current_school_id() from public;
revoke execute on function public.current_user_role() from public;
revoke execute on function public.is_admin() from public;
revoke execute on function public.same_school(uuid) from public;
revoke execute on function public.fill_period_minutes() from public;
revoke execute on function public.period_minutes(uuid, public.course_level, smallint) from public;
revoke execute on function public.guard_profiles_update() from public;
revoke execute on function public.guard_reservation_update() from public;
revoke execute on function public.purge_expired_ai_cache() from public;
revoke execute on function public.purge_expired_audit_logs() from public;

grant execute on function public.current_school_id() to authenticated;
grant execute on function public.is_admin() to authenticated;
grant execute on function public.same_school(uuid) to authenticated;
grant execute on function public.purge_expired_ai_cache() to service_role;
grant execute on function public.purge_expired_audit_logs() to service_role;
