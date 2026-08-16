import { PageHeader } from '@/components/ui'
import { VideoKitForm } from './video-kit-form'

export default async function VideoKitPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const params = await searchParams
  const title = typeof params.title === 'string' ? params.title.slice(0, 200) : ''
  const videoId = typeof params.videoId === 'string' && /^[\w-]{6,20}$/.test(params.videoId) ? params.videoId : ''
  const duration = typeof params.duration === 'string' && /^\d{1,5}$/.test(params.duration) ? Number(params.duration) : 0
  return <><PageHeader title="영상 수업 꾸러미" description="선택한 유튜브 영상으로 시청 전·중·후 활동을 만듭니다. 학생별 정보는 입력하지 않습니다." /><VideoKitForm defaults={{ title, url: videoId ? `https://www.youtube.com/watch?v=${videoId}` : '', durationSec: duration }} /></>
}
