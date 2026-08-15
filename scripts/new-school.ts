/**
 * 학교 등록.
 *
 *   npm run school:new -- "○○특수학교" kyogam@school.kr "정한결"
 *
 * 스키마는 처음부터 여러 학교를 담을 수 있게 만들었지만(모든 테이블에 school_id,
 * RLS 로 격리), 학교를 새로 여는 일만은 화면에서 할 수 없다.
 *
 * 이유는 닭-달걀이다. 초대는 "이미 그 학교 관리자인 사람"만 만들 수 있는데,
 * 새 학교에는 아직 관리자가 없다. 그렇다고 아무나 학교를 만들 수 있게 열어두면
 * 로그인만 하면 새 테넌트를 찍어낼 수 있게 된다.
 *
 * 그래서 서버 키를 가진 사람이 명령줄에서만 학교를 열도록 했다.
 * 첫 관리자에게 줄 초대 링크가 함께 나온다. 그 뒤부터는 화면에서 처리된다.
 */

import { createClient } from '@supabase/supabase-js'
import { createHash, randomBytes } from 'node:crypto'
import type { Database } from '../lib/supabase/database.types'

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

const DEFAULT_DEPARTMENTS = ['교무부', '연구부', '생활지도부', '진로직업부', '방과후부']

async function main() {
  // 같은 이름의 학교가 이미 있으면 멈춘다. 실수로 두 번 만들면
  // 교직원이 어느 쪽에 초대됐는지 알 수 없게 된다.
  const { data: existing } = await db
    .from('schools')
    .select('id, name')
    .eq('name', schoolName!)
    .maybeSingle()

  if (existing) {
    console.error(`이미 등록된 학교입니다: ${schoolName}`)
    console.error('교직원을 더 넣으려면 관리자 계정으로 로그인해 "학교 관리"에서 초대하세요.')
    process.exit(1)
  }

  const { data: school, error: schoolError } = await db
    .from('schools')
    .insert({
      name: schoolName!,
      neis_code: neisCode ?? null,
      timezone: 'Asia/Seoul',
      is_demo: false,
    })
    .select('id')
    .single()

  if (schoolError || !school) {
    console.error('학교를 만들지 못했습니다:', schoolError)
    process.exit(1)
  }

  await db
    .from('departments')
    .insert(DEFAULT_DEPARTMENTS.map((name) => ({ school_id: school.id, name })))

  // 결보강 가중치는 기본값으로 시작한다. 관리자가 화면에서 조정한다.
  await db.from('substitution_rules').insert({ school_id: school.id })

  // 첫 관리자 초대. 평문 토큰은 여기서 한 번만 출력되고 DB 에는 해시만 남는다.
  const token = randomBytes(32).toString('base64url')
  const tokenHash = createHash('sha256').update(token).digest('hex')
  const expiresAt = new Date(Date.now() + 72 * 60 * 60 * 1000)

  const { error: inviteError } = await db.from('invitations').insert({
    school_id: school.id,
    email: adminEmail!.toLowerCase(),
    name: adminName!,
    role: 'admin',
    employment: 'full_time',
    token_hash: tokenHash,
    expires_at: expiresAt.toISOString(),
  })

  if (inviteError) {
    console.error('초대를 만들지 못했습니다:', inviteError)
    process.exit(1)
  }

  const base = process.env.APP_URL ?? 'http://localhost:3000'

  console.log('')
  console.log(`학교를 열었습니다: ${schoolName}`)
  console.log(`  부서 ${DEFAULT_DEPARTMENTS.length}개, 결보강 기본 규칙까지 넣었습니다.`)
  console.log('')
  console.log('첫 관리자에게 아래 링크를 전달하세요. 72시간 뒤 만료됩니다.')
  console.log('')
  console.log(`  ${base}/invite/${token}`)
  console.log('')
  console.log('그 뒤로는 관리자가 화면에서 나머지 교직원을 초대합니다.')
  console.log('')
  console.log('다음에 할 일:')
  console.log('  1. 관리자 로그인 → 학교 관리에서 교직원 초대')
  console.log('  2. 학년도·학기, 과정별 시정표, 학급, 특별실 등록')
  console.log('  3. 시간표 올리기')
}

main().catch((error) => {
  console.error('실패:', error)
  process.exit(1)
})
