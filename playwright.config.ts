import { defineConfig, devices } from '@playwright/test'

/**
 * e2e 테스트 설정.
 *
 * 이 테스트들은 진짜 Supabase 백엔드가 필요하다 — 데모 학교
 * 「한빛특수학교」가 이미 시드돼 있는 서버(로컬 dev 서버 + 실제 Supabase
 * 프로젝트, 또는 배포된 사이트)를 대상으로 돌려야 의미가 있다. 목(mock)
 * 데이터로 대체하지 않는다 — RLS·트리거·DB 제약까지 실제로 걸리는지
 * 확인하는 게 이 테스트의 목적이기 때문이다.
 *
 * 실행:
 *   npm run test:e2e                    로컬 dev 서버를 직접 띄워서 (.env.local 필요)
 *   E2E_BASE_URL=https://... npm run test:e2e   이미 떠 있는 서버(배포본 등)를 대상으로
 *
 * 데모 학교는 새벽에 자동 초기화되고 여러 사람이 동시에 체험하기로 들어올
 * 수 있는 공유 환경이다 — 그래서 테스트가 "이 방·이 시간은 비어 있다"를
 * 전제하지 않고, 화면에서 실제로 비어 있는 칸을 찾아 그 자리에서 직접
 * 충돌을 만들어 검증하는 방식으로 짰다(고정된 방 이름·날짜에 기대지 않음).
 */

const PORT = process.env.PORT ?? 3000
const baseURL = process.env.E2E_BASE_URL ?? `http://localhost:${PORT}`

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: false, // 같은 데모 계정·같은 학교 데이터를 여러 테스트가 함께 건드린다
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  reporter: 'list',
  timeout: 30_000,
  use: {
    baseURL,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: process.env.E2E_BASE_URL
    ? undefined
    : {
        command: 'npm run dev',
        url: baseURL,
        reuseExistingServer: !process.env.CI,
        timeout: 120_000,
      },
})
