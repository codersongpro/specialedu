'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { encryptSecret, keyHint } from '@/lib/security/crypto'
import { createClient, requireSession } from '@/lib/supabase/server'

const KeyInput = z.object({
  apiKey: z.string().min(20, '키가 너무 짧습니다').max(200),
})

export interface KeyState {
  error?: string
  ok?: boolean
}

/**
 * 개인 Gemini 키 등록.
 *
 * 무료 티어는 호출 한도가 있어, 각자 자기 키를 쓰면 한도가 분산된다.
 * 키는 암호화해서 넣고, 화면에는 뒷 4자리만 보여준다.
 */
export async function savePersonalKey(_prev: KeyState, formData: FormData): Promise<KeyState> {
  const session = await requireSession()

  const parsed = KeyInput.safeParse({ apiKey: formData.get('apiKey') })
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? '키를 확인하세요' }
  }

  const apiKey = parsed.data.apiKey.trim()

  const supabase = await createClient()
  const { error } = await supabase
    .from('profiles')
    .update({
      gemini_key_enc: encryptSecret(apiKey),
      gemini_key_hint: keyHint(apiKey),
    })
    .eq('id', session.userId)

  if (error) return { error: '저장하지 못했습니다' }

  revalidatePath('/settings')
  return { ok: true }
}

export async function removePersonalKey(): Promise<void> {
  const session = await requireSession()
  const supabase = await createClient()
  await supabase
    .from('profiles')
    .update({ gemini_key_enc: null, gemini_key_hint: null })
    .eq('id', session.userId)
  revalidatePath('/settings')
}

/** 캘린더 구독 주소가 새어 나갔을 때 갈아 끼운다 */
export async function rotateCalendarToken(): Promise<void> {
  const session = await requireSession()
  const supabase = await createClient()
  await supabase
    .from('profiles')
    .update({ calendar_token: crypto.randomUUID() })
    .eq('id', session.userId)
  revalidatePath('/settings')
}
