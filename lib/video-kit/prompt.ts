export interface VideoKitInput {
  course: string
  subject: string
  topic: string
  level: 1 | 2 | 3
  videoTitle: string
  videoUrl: string
  durationSec: number
}

export function videoKitPrompt(input: VideoKitInput): string {
  return `특수학교 수업용 영상 꾸러미를 만듭니다. 학생 이름이나 개인별 특성은 추정하거나 쓰지 마세요.

과정: ${input.course}
교과: ${input.subject}
주제: ${input.topic}
수준: ${input.level}단계(1이 가장 쉬움)
영상 제목: ${input.videoTitle}
영상 주소: ${input.videoUrl}
영상 길이: ${input.durationSec}초

다음 순서로 구체적이고 짧게 작성하세요.
1. 시청 전 활동
2. 시청 중 확인 질문
3. 시청 후 활동
4. 대체 활동
5. 접근성 유의점
6. 교사 검수 항목

다음 JSON 형식으로만 답하세요:
{"result":"수업 꾸러미 본문"}`
}
