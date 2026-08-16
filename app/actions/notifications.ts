'use server'

import { createClient, requireSession } from '@/lib/supabase/server'

export interface NotificationItem {
  id: string
  title: string
  body: string | null
  link: string | null
  readAt: string | null
  createdAt: string
}

/** 벨 아이콘을 열 때·Realtime 이벤트를 받았을 때 최신 목록을 다시 받아온다 */
export async function getMyNotifications(): Promise<NotificationItem[]> {
  const session = await requireSession()
  const supabase = await createClient()

  const { data } = await supabase
    .from('notifications')
    .select('id, title, body, link, read_at, created_at')
    .eq('profile_id', session.userId)
    .order('created_at', { ascending: false })
    .limit(30)

  return (data ?? []).map((n) => ({
    id: n.id,
    title: n.title,
    body: n.body,
    link: n.link,
    readAt: n.read_at,
    createdAt: n.created_at,
  }))
}

export async function markNotificationRead(id: string): Promise<void> {
  await requireSession()
  const supabase = await createClient()
  await supabase.from('notifications').update({ read_at: new Date().toISOString() }).eq('id', id)
}

export async function markAllNotificationsRead(): Promise<void> {
  const session = await requireSession()
  const supabase = await createClient()
  await supabase
    .from('notifications')
    .update({ read_at: new Date().toISOString() })
    .eq('profile_id', session.userId)
    .is('read_at', null)
}
