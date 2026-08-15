'use client'

import { createBrowserClient } from '@supabase/ssr'
import type { Database } from './database.types'

/**
 * 브라우저용 클라이언트.
 *
 * anon 키만 쓴다. 이 키로 할 수 있는 일은 RLS 정책이 허용하는 범위로 제한된다.
 * service role 키는 절대 이쪽으로 넘어오면 안 된다.
 */
export function createClient() {
  return createBrowserClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  )
}
