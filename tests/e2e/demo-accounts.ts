/**
 * 데모 계정 정보 (README·docs/사용설명서.md 에 적힌 것과 같음).
 *
 * lib/demo/seed-data.ts 의 값을 그대로 옮겨 적었다 — e2e 테스트는 Playwright
 * 자체 컴파일러(esbuild)로 돌아 tsconfig.json의 경로 별칭(@/*)을 안 타므로,
 * import 대신 리터럴로 중복해 두는 편이 설정 복잡도가 낮다.
 */
export const DEMO_PASSWORD = 'Demo!2026'

export const DEMO = {
  admin: 'admin@hanbit.demo',
  manager: 'manager@hanbit.demo',
  teacher: 'teacher@hanbit.demo',
  partTime: 'parttime@hanbit.demo',
} as const
