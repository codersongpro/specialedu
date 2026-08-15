import { dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { FlatCompat } from '@eslint/eslintrc'

const compat = new FlatCompat({
  baseDirectory: dirname(fileURLToPath(import.meta.url)),
})

const config = [
  ...compat.extends('next/core-web-vitals', 'next/typescript'),
  {
    // next-env.d.ts 는 Next 가 만들어 내는 파일이라 손대지 않는다
    ignores: ['.next/**', 'node_modules/**', 'supabase/**', 'next-env.d.ts'],
  },
  {
    rules: {
      // 서버 액션에서 unknown 을 다룰 일이 잦아 경고로만 둔다
      '@typescript-eslint/no-explicit-any': 'warn',
    },
  },
]

export default config
