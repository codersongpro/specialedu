-- Supabase가 개별 역할에 부여한 기존 실행 권한을 최소화한다.
-- current_school_id와 is_admin은 RLS 정책 평가에 필요하므로 authenticated만 유지한다.

revoke execute on function public.current_school_id() from anon, service_role;
revoke execute on function public.is_admin() from anon, service_role;

revoke execute on function public.current_user_role() from anon, authenticated, service_role;
revoke execute on function public.fill_period_minutes() from anon, authenticated, service_role;
revoke execute on function public.guard_profiles_update() from anon, authenticated, service_role;
revoke execute on function public.guard_reservation_update() from anon, authenticated, service_role;
revoke execute on function public.period_minutes(uuid, public.course_level, smallint) from anon, authenticated, service_role;
revoke execute on function public.purge_expired_ai_cache() from anon, authenticated;
revoke execute on function public.purge_expired_audit_logs() from anon, authenticated;
