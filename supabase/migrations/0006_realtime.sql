-- =============================================================================
-- 0006_realtime — 특별실 예약·결보강·학사일정을 실시간으로 반영
--
-- "체험하기"로 여러 사람이 동시에 들어와 같은 데이터를 만질 때, 한쪽이
-- 바꾼 내용이 다른 쪽 화면에 새로고침 없이 바로 보이게 한다.
--
-- Supabase 는 프로젝트마다 빈 supabase_realtime publication 을 미리 만들어
-- 둔다. 여기에 테이블을 추가해야 그 테이블의 변경이 클라이언트로 방송된다.
-- RLS 가 걸린 테이블은 Realtime 도 같은 정책을 따르므로, 구독한 사람이
-- 원래 볼 수 없는 학교의 행은 여기서도 오지 않는다.
--
-- pg_publication_tables 로 이미 들어있는지 먼저 확인한다 — schema.sql 을
-- 처음부터 다시 실행하는 경로(테이블을 지웠다 새로 만듦)에서는 항상
-- 비어있어 문제없지만, 이 파일 하나만 다시 돌리는 경우에도 안전하게
-- 만들어 둔다.
-- =============================================================================

do $$
declare
  t text;
begin
  foreach t in array array[
    'room_reservations',
    'substitution_assignments',
    'absences',
    'academic_events'
  ]
  loop
    if not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = t
    ) then
      execute format('alter publication supabase_realtime add table public.%I', t);
    end if;
  end loop;
end $$;
