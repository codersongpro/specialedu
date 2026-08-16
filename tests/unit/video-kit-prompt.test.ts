import { describe, expect, it } from 'vitest'
import { videoKitPrompt } from '@/lib/video-kit/prompt'

describe('videoKitPrompt', () => {
  it('requests the classroom activity sections and keeps the video metadata limited', () => {
    const prompt = videoKitPrompt({
      course: '초등', subject: '과학', topic: '날씨', level: 1,
      videoTitle: '비가 오는 날', videoUrl: 'https://www.youtube.com/watch?v=abc123', durationSec: 180,
    })

    expect(prompt).toContain('시청 전 활동')
    expect(prompt).toContain('시청 중 확인 질문')
    expect(prompt).toContain('시청 후 활동')
    expect(prompt).toContain('대체 활동')
    expect(prompt).toContain('접근성 유의점')
    expect(prompt).toContain('교사 검수 항목')
    expect(prompt).toContain('비가 오는 날')
    expect(prompt).not.toContain('홍길동')
  })
})
