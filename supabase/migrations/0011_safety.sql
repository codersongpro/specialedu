-- =============================================================================
-- 0011_safety — 학생 안전 프로토콜 카드
--
-- 발작·알레르기·연하곤란처럼 응급 시 즉시 확인해야 하는 대응 절차를
-- 담임 개인 기억이나 종이 대신 앱에서 바로 찾을 수 있게 한다. "학생
-- 지원" 카테고리라 student_sensitive 등급이 자동으로 걸린다
-- (lib/security/sensitivity.ts) — 진입 경고·상시 배너는 이미 있는
-- 인프라를 그대로 탄다.
--
-- 대응 절차 본문은 자유 텍스트고 의료 정보라 PBS 기록과 같은 방식으로
-- 암호화해 저장한다(lib/security/crypto.ts). 응급 상황에 빨리 찾아야
-- 하므로 조회 자체는 학교 교직원 전체에게 열어 둔다 — 대신 작성·수정은
-- 정확성을 위해 관리자만 가능하게 한다.
-- =============================================================================

create table public.safety_protocols (
  id          uuid primary key default gen_random_uuid(),
  school_id   uuid not null references public.schools(id) on delete cascade,
  student_id  uuid not null references public.students(id) on delete cascade,
  category    text not null check (category in ('seizure', 'allergy', 'dysphagia', 'other')),
  title       text not null,
  content_enc text not null,
  created_by  uuid references public.profiles(id) on delete set null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index safety_protocols_student_idx on public.safety_protocols(school_id, student_id);

create trigger safety_protocols_touch before update on public.safety_protocols
  for each row execute function public.touch_updated_at();

alter table public.safety_protocols enable row level security;

create policy safety_protocols_select on public.safety_protocols for select
  using (public.same_school(school_id));

create policy safety_protocols_write on public.safety_protocols for all
  using (public.same_school(school_id) and public.is_admin())
  with check (public.same_school(school_id) and public.is_admin());
