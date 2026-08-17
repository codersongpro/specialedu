/**
 * supabase/schema.sql 을 supabase/reset.sql + supabase/migrations/*.sql 을
 * 순서대로 이어 붙여 다시 만든다.
 *
 * schema.sql 은 "마이그레이션을 순서대로 이어 붙인 것"이라고 스스로 적어
 * 두고 있는데, 예전에 실수로 파일 본문을 손으로 두 줄 고친 적이 있다
 * (0015 를 빠뜨린 채 결과만 맞춰 넣음) — 다음에 또 손으로 고치는 사고를
 * 막기 위해, 마이그레이션을 추가할 때마다 이 스크립트로 다시 생성한다.
 *
 * 사용법: npm run db:schema
 */
import { readFileSync, readdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

const ROOT = join(__dirname, '..', 'supabase')
const TODAY = new Date().toISOString().slice(0, 10)

function section(title: string, body: string): string {
  const bar = '─'.repeat(77)
  return `-- ${bar}\n-- ${title}\n-- ${bar}\n\n${body.trimEnd()}\n`
}

const migrationsDir = join(ROOT, 'migrations')
const migrationFiles = readdirSync(migrationsDir)
  .filter((f) => f.endsWith('.sql'))
  .sort()

const resetSql = readFileSync(join(ROOT, 'reset.sql'), 'utf8')

const header = `-- =============================================================================
-- 한 번에 붙여넣는 스키마
--
-- Supabase 대시보드 > SQL Editor 에 이 파일을 통째로 붙여넣고 실행하세요.
-- supabase/migrations/ 의 파일을 순서대로 이어 붙인 것입니다.
-- CLI(supabase db push)를 쓰신다면 이 파일은 필요 없습니다.
--
-- 이 파일은 몇 번을 다시 실행해도 안전합니다 — 맨 앞에서 우리가 만드는
-- 객체를 전부 지우고 처음부터 다시 만듭니다 (supabase/reset.sql 내용).
-- 실 데이터가 있는 학교 DB에서는 절대 실행하지 마세요 — 실행하면
-- reset.sql의 안전장치가 실제 학교 데이터를 감지해 자동으로 막습니다.
--
-- 이 파일은 손으로 고치지 마세요 — "npm run db:schema"로 다시 만드세요.
--
-- 만들어진 시각: ${TODAY}
-- =============================================================================

`

const parts = [header, section('reset.sql — 처음부터 다시 실행하기 위한 초기화', resetSql)]

for (const file of migrationFiles) {
  const body = readFileSync(join(migrationsDir, file), 'utf8')
  parts.push(section(file, body))
}

writeFileSync(join(ROOT, 'schema.sql'), parts.join('\n'))
console.log(`supabase/schema.sql 재생성 완료 (마이그레이션 ${migrationFiles.length}개)`)
