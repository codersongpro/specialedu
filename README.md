# 특수학교 교직원 업무 지원 앱

특별실 예약, 결보강 배정, 학사일정을 한 곳에서 처리합니다.
초·중(자유학기)·고(고교학점제)·전공과(직업실습)가 한 건물에서 함께 돌아가는
특수학교 사정에 맞춰 만들었습니다.

> 사용 방법은 **[docs/사용설명서.md](docs/사용설명서.md)** 를 보세요.
> 이 문서는 개발·배포용입니다.

---

## 지금 되는 것

| 기능 | 상태 |
|---|---|
| 특별실 예약 (충돌 검사·자동 추천·승인) | 됨 |
| 결보강 (결과 신청 → 후보 추천 → 배정 → 강사료 정산) | 됨 |
| 학사일정·행사 (주간/월간, 범위별 공유, 캘린더 구독) | 됨 |
| 시간표 보기 (교사별·학급별) | 됨 |
| 교직원 초대·권한, 접속 기록 | 됨 |
| 예산 관리 · PBS · 수업 도구함(AI) | 메뉴만 있고 준비 중 |

---

## 설계에서 놓치면 안 되는 것 세 가지

**1. 시각은 교시 번호가 아니라 분(minute)으로 비교한다**

초등 3교시는 10:40~11:20, 고등 3교시는 11:00~11:50 입니다. 교시 번호가 같아도
실제로는 20분 겹칩니다. 교시 번호로 충돌을 판정하면 이 예약을 통과시켜 버립니다.
모든 시각은 `periods` 테이블을 거쳐 자정부터의 분으로 환산되고,
비교는 `lib/scheduling/time.ts` 를 통해서만 합니다.

**2. 이중예약은 DB가 막는다**

애플리케이션 검사만으로는 두 사람이 같은 순간에 신청하는 경쟁 조건을 막을 수 없습니다.
`room_reservations` 에 배타 제약이 걸려 있습니다.

```sql
exclude using gist (
  room_id with =, reserved_date with =,
  int4range(starts_min, ends_min) with &&
) where (status = 'approved')
```

**3. 학생 실명은 저장하지 않는다**

장애 관련 정보는 개인정보보호법 제23조 민감정보입니다. `students` 테이블에는
실명·생년월일·주소·연락처·진단명 **컬럼 자체가 없습니다.** 학번과 이니셜만 둡니다.
유출되어도 개인을 식별할 수 없는 구조가 어떤 암호화보다 강합니다.
컬럼을 추가하고 싶어지면 먼저 이 결정을 다시 검토하세요.

---

## 셋업

### 1. Supabase 프로젝트

[supabase.com](https://supabase.com) 에서 프로젝트를 만듭니다.
**리전은 Northeast Asia (Seoul)** 로 고르세요. 국외 이전 문제를 피할 수 있습니다.

### 2. 환경변수

```bash
cp .env.example .env.local
```

`.env.local` 을 열어 채웁니다.

| 변수 | 어디서 |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase > 프로젝트 설정 > API |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | 같은 화면 |
| `SUPABASE_SERVICE_ROLE_KEY` | 같은 화면. **절대 `NEXT_PUBLIC_` 을 붙이지 마세요** |
| `GEMINI_KEY_ENCRYPTION_KEY` | `openssl rand -base64 32` |

### 3. 스키마 올리기

```bash
npx supabase link --project-ref <프로젝트-ref>
npx supabase db push
```

또는 Supabase 대시보드의 SQL Editor 에서 `supabase/migrations/` 의 파일을
`0001` 부터 순서대로 실행합니다.

### 4. 데모 데이터 (선택)

```bash
SEED_DEMO=true npm run seed:demo
```

가상 학교 「한빛특수학교」가 만들어집니다. 실존 인물 정보는 없습니다.

| 계정 | 비밀번호 | 역할 |
|---|---|---|
| `admin@hanbit.demo` | `Demo!2026` | 관리자(교감) |
| `manager@hanbit.demo` | `Demo!2026` | 교무부장 |
| `teacher@hanbit.demo` | `Demo!2026` | 고3-1 담임 |
| `parttime@hanbit.demo` | `Demo!2026` | 시간강사 (화·목만 출근) |

나머지 교직원은 `staff1@hanbit.demo` ~ `staff21@hanbit.demo` 입니다.

데모 학교는 `is_demo` 플래그가 붙고 `school_id` 가 달라, RLS 때문에
실제 학교 데이터와 어떤 경로로도 섞이지 않습니다.

### 5. 띄우기

```bash
npm install
npm run dev
```

---

## 여러 학교 쓰기

스키마는 처음부터 멀티테넌트입니다. 모든 테이블에 `school_id` 가 있고
RLS 로 격리되어, A학교 교사가 B학교 자료를 조회하면 0건이 나옵니다.
한 인스턴스에 여러 특수학교를 올려 쓸 수 있습니다.

학교를 새로 여는 것만 명령줄에서 합니다.

```bash
npm run school:new -- "○○특수학교" kyogam@school.kr "정한결"
```

첫 관리자에게 줄 초대 링크가 출력됩니다. 그 뒤로는 관리자가 화면에서
나머지 교직원을 초대합니다.

화면에 열어 두지 않은 이유는 닭-달걀 문제입니다. 초대는 "이미 그 학교
관리자인 사람"만 만들 수 있는데 새 학교에는 아직 관리자가 없고, 그렇다고
아무나 학교를 만들 수 있게 열면 로그인만으로 테넌트를 찍어낼 수 있게 됩니다.
서버 키를 가진 사람만 학교를 열도록 두는 편이 안전합니다.

**한 사람이 두 학교에 동시에 속하지는 못합니다.** `profiles.school_id` 가
하나뿐입니다. 순회교사처럼 여러 학교를 오가는 경우가 생기면
`profiles` 를 학교별 멤버십 테이블로 나눠야 합니다.

---

## 배포 (Vercel)

1. Vercel 에 저장소를 연결합니다.
2. 환경변수 4개를 프로젝트 설정에 넣습니다 (`.env.local` 과 같은 값).
3. `vercel.json` 이 함수 리전을 `icn1`(서울)로 고정합니다. 데이터가 국내에 머뭅니다.
4. 학교에 열기 전까지는 **Deployment Protection** 을 켜 두세요.

`CRON_SECRET` 을 설정하면 주 1회 도는 파기 배치(`/api/cron/purge`)를
외부에서 호출할 수 없게 막습니다.

---

## 명령어

```bash
npm run dev          # 개발 서버
npm run build        # 빌드
npm run typecheck    # 타입 검사
npm run lint         # 린트
npm run test         # 단위 테스트
npm run test:e2e     # 브라우저 테스트
npm run db:types     # DB 스키마에서 타입 다시 뽑기
npm run seed:demo    # 데모 데이터 (SEED_DEMO=true 필요)
```

---

## 구조

```
app/
  (app)/            로그인 후 화면. 레이아웃이 민감도 경고를 자동으로 건다
  login, invite/    인증. 공개 회원가입 경로는 없다
  api/              캘린더 구독(ICS), CSV 내보내기, 파기 배치
lib/
  scheduling/       충돌 검사·특별실 추천 (순수 함수)
  substitution/     결보강 후보 스코어링 (순수 함수)
  security/         마스킹, 암호화, 감사로그, 메뉴 민감도
  supabase/         클라이언트 3종 (server / client / admin)
supabase/migrations/  스키마 + RLS 정책
scripts/seed.ts     데모 데이터
tests/unit/         엔진 테스트 59개
```

배정 로직은 DB·네트워크와 분리된 **순수 함수**입니다. 학교마다 규칙이 달라
가장 자주 고쳐질 부분이고, 순수 함수여야 테스트로 회귀를 잡을 수 있습니다.
같은 함수를 브라우저와 서버가 함께 씁니다 — 화면에서는 즉시 경고를 띄우고,
서버에서 다시 검사해 최종 판정을 합니다. **클라이언트 판정은 믿지 않습니다.**

---

## 보안

- 전 테이블 RLS. 학교끼리 격리되고, 역할에 따라 볼 수 있는 범위가 다릅니다
- 공개 회원가입 없음. 관리자가 만든 초대 링크로만 가입합니다 (토큰은 해시로 저장, 72시간 만료)
- 개인정보 조회·수정 기록을 2년 보관하고 자동 파기합니다
- API 키는 AES-256-GCM 으로 암호화해 저장하고, 화면에는 뒷 4자리만 보입니다
- CSV 내보내기에 수식 인젝션 방지를 적용합니다
- CI가 service role 키의 클라이언트 번들 유출을 빌드 산출물에서 직접 검사합니다

수업 도구함(Phase 4)은 **무료 Gemini 키를 전제**로 설계했습니다.
무료 티어는 전송 내용이 학습에 쓰일 수 있으므로, 유료 전환 대신
개인정보가 애초에 Google 에 도달하지 않게 막습니다 — 템플릿 폼 입력,
전송 전 마스킹 왕복(`lib/security/pii.ts`), 사람의 최종 확인,
주민등록번호·계좌번호 강제 차단의 4단계입니다.

한계를 분명히 해 둡니다: **학생 이름은 자동으로 100% 잡을 수 없습니다.**
가명처리 원칙 때문에 앱에 학생 명렬표가 없어 대조할 사전이 없습니다.
그래서 전송 전 사람이 확인하는 화면이 선택이 아니라 필수 경유 단계입니다.
