'use client'

import { useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

/**
 * 같은 학교의 다른 사람이 데이터를 바꾸면, 새로고침 없이 화면을 다시 그린다.
 *
 * 화면은 전부 서버 컴포넌트라 실시간 상태를 따로 관리하지 않는다. 대신
 * Postgres 변경 이벤트가 오면 router.refresh() 로 서버 컴포넌트를 다시
 * 실행시킨다 — 데이터 흐름은 그대로 두고 "언제 다시 가져올지"만 실시간으로
 * 트리거하는 방식이라, 화면마다 실시간 코드를 새로 짤 필요가 없다.
 *
 * RLS 가 걸린 테이블이라 학교 밖 데이터는 애초에 이 클라이언트로 오지
 * 않는다 — 그래도 필터를 school_id 로 한 번 더 좁혀서 같은 학교 안에서도
 * 불필요한 새로고침을 줄인다.
 *
 * 짧은 시간에 변경이 몰리면(시드 스크립트처럼) 새로고침도 몰아치므로
 * 디바운스한다.
 */
export function RealtimeRefresh({
  schoolId,
  tables,
}: {
  schoolId: string
  tables: string[]
}) {
  const router = useRouter()
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    const supabase = createClient()
    const channel = supabase.channel(`refresh:${schoolId}:${tables.join(',')}`)

    for (const table of tables) {
      channel.on(
        'postgres_changes',
        { event: '*', schema: 'public', table, filter: `school_id=eq.${schoolId}` },
        () => {
          if (timer.current) clearTimeout(timer.current)
          timer.current = setTimeout(() => router.refresh(), 400)
        },
      )
    }

    channel.subscribe()

    return () => {
      if (timer.current) clearTimeout(timer.current)
      void supabase.removeChannel(channel)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- tables 는 호출부에서 리터럴 배열로 넘어와 매 렌더 참조가 바뀐다
  }, [schoolId, tables.join(',')])

  return null
}
