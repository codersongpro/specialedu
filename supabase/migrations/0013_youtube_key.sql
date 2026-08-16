-- =============================================================================
-- 0013_youtube_key — 유튜브 검색 키를 학교별·개인별로 분리
--
-- 지금까지 "수업 자료 찾기"(유튜브 검색)는 서버 환경변수 YOUTUBE_API_KEY
-- 하나를 배포 전체가 공유했다. Gemini 키는 이미 학교 공용(schools) +
-- 개인(profiles) 두 층으로 나뉘어 있는데 유튜브 키만 그렇지 않았던 것 —
-- 여러 학교가 한 배포를 같이 쓰면 한 사람이 등록한 키를 다른 학교
-- 교직원까지 전부 나눠 쓰게 되는 구조였다. Gemini와 똑같은 방식으로
-- 맞춘다: 학교 공용 키를 기본으로 쓰고, 개인 키가 있으면 그걸 우선한다.
-- =============================================================================

alter table public.schools
  add column youtube_key_enc  text,
  add column youtube_key_hint text;

comment on column public.schools.youtube_key_enc is
  'AES-256-GCM 암호문. 복호화 키는 서버 환경변수 GEMINI_KEY_ENCRYPTION_KEY(재사용).';

alter table public.profiles
  add column youtube_key_enc  text,
  add column youtube_key_hint text;

comment on column public.profiles.youtube_key_enc is
  'AES-256-GCM 암호문. 개인 키 — 있으면 학교 공용보다 우선.';
