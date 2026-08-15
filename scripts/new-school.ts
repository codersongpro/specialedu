/**
 * 학교 등록 (명령줄).
 *
 *   npm run school:new -- "○○특수학교" kyogam@school.kr "정한결"
 *
 * 화면(PLATFORM_ADMIN_EMAILS 로 로그인한 사람의 /platform)으로도 같은 일을
 * 할 수 있다. 이 스크립트는 그 환경변수를 아직 설정하지 않았을 때 쓰는
 * 부트스트랩 경로다 — 최고관리자 계정도 아직 없는 첫 배포 시점에 필요하다.
 *
 * 실제 로직은 lib/platform/create-school.ts 를 공유한다.
 */

import { createClient } from '@supabase/supabase-js'
import type { Database } from '../lib/supabase/database.types'
import { createSchoolWithFirstAdmin, SchoolAlreadyExistsError } from '../lib/platform/create-school'

const url = process.env.NEXT_PUBLIC_SUPABASE_URL
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!url || !serviceKey) {
  console.error('NEXT_PUBLIC_SUPABASE_URL 과 SUPABASE_SERVICE_ROLE_KEY 가 필요합니다.')
  process.exit(1)
}

const [schoolName, adminEmail, adminName, neisCode] = process.argv.slice(2)

if (!schoolName || !adminEmail || !adminName) {
  console.error('사용법:')
  console.error('  npm run school:new -- "<학교 이름>" <관리자 이메일> "<관리자 이름>" [나이스코드]')
  console.error('')
  console.error('예시:')
  console.error('  npm run school:new -- "한빛특수학교" kyogam@hanbit.kr "정한결"')
  process.exit(1)
}

if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(adminEmail)) {
  console.error(`이메일 형식이 아닙니다: ${adminEmail}`)
  process.exit(1)
}

const db = createClient<Database>(url, serviceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
})

async function main() {
  try {
    const result = await createSchoolWithFirstAdmin(db, {
      name: schoolName!,
      adminEmail: adminEmail!,
      adminName: adminName!,
      neisCode: neisCode ?? null,
    })

    const base = process.env.APP_URL ?? 'http://localhost:3000'

    console.log('')
    console.log(`학교를 열었습니다: ${schoolName}`)
    console.log('  부서 5개, 결보강 기본 규칙까지 넣었습니다.')
    console.log('')
    console.log('첫 관리자에게 아래 링크를 전달하세요. 72시간 뒤 만료됩니다.')
    console.log('')
    console.log(`  ${base}/invite/${result.inviteToken}`)
    console.log('')
    console.log('그 뒤로는 관리자가 화면에서 나머지 교직원을 초대합니다.')
    console.log('')
    console.log('다음에 할 일:')
    console.log('  1. 관리자 로그인 → 학교 관리에서 교직원 초대')
    console.log('  2. 학년도·학기, 과정별 시정표, 학급, 특별실 등록')
    console.log('  3. 시간표 올리기')
  } catch (error) {
    if (error instanceof SchoolAlreadyExistsError) {
      console.error(error.message)
      console.error('교직원을 더 넣으려면 관리자 계정으로 로그인해 "학교 관리"에서 초대하세요.')
      process.exit(1)
    }
    console.error('실패:', error)
    process.exit(1)
  }
}

main()
