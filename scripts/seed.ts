/**
 * 데모 데이터 시드 (명령줄).
 *
 *   SEED_DEMO=true npm run seed:demo
 *
 * 실제 만드는 일은 lib/demo/seed.ts 가 한다. 배포한 뒤에는 로컬에 아무것도
 * 깔지 않고 브라우저에서도 만들 수 있어야 해서 로직을 그쪽에 두었다.
 */

import { createClient } from '@supabase/supabase-js'
import type { Database } from '../lib/supabase/database.types'
import { seedDemoSchool } from '../lib/demo/seed'

const url = process.env.NEXT_PUBLIC_SUPABASE_URL
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (process.env.SEED_DEMO !== 'true') {
  console.error('안전장치가 걸려 있습니다. SEED_DEMO=true 를 붙여 실행하세요.')
  console.error('  SEED_DEMO=true npm run seed:demo')
  process.exit(1)
}

if (!url || !serviceKey) {
  console.error('NEXT_PUBLIC_SUPABASE_URL 과 SUPABASE_SERVICE_ROLE_KEY 가 필요합니다.')
  process.exit(1)
}

const db = createClient<Database>(url, serviceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
})

seedDemoSchool(db, (message) => console.log(message)).catch((error) => {
  console.error('\n시드 실패:', error)
  process.exit(1)
})
