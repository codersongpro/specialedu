'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { createClient, requireSession } from '@/lib/supabase/server'

const idSchema = z.string().uuid()

export async function deletePersonalDraft(formData: FormData): Promise<void> {
  await requireSession()
  const id = idSchema.safeParse(formData.get('id'))
  if (!id.success) return
  const supabase = await createClient()
  await supabase.from('personal_drafts').delete().eq('id', id.data)
  revalidatePath('/toolbox/drafts')
}
