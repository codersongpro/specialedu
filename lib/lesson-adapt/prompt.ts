export type LessonAdaptInput = {
  course: string
  subject: string
  topic: string
  objective: string
  material: string
  level: 1 | 2 | 3
  duration: number
  supplies: string
}

export function lessonAdaptPrompt(input: LessonAdaptInput): string {
  return `특수학교 수업 자료를 학생 수준에 맞게 바꿉니다.
과정: ${input.course}
교과: ${input.subject}
주제: ${input.topic}
수업 목표: ${input.objective}
현재 자료: ${input.material}
목표 수준: ${input.level}단계
수업 시간: ${input.duration}분
준비 가능 재료: ${input.supplies}

아래 제목을 그대로 사용해 한국어로 작성하세요.
1. 도입
2. 활동
3. 정리
4. 쉬운 말
5. 시각 지원 아이디어
6. 난이도 조절
7. 교사 확인 항목

다음 JSON 형식으로만 답하세요:
{"result":"위 구조를 따른 수업안"}`
}
