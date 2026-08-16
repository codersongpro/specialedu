export type WorkflowTool = 'document_checklist' | 'trip_plan' | 'meeting_notes'

const INSTRUCTIONS: Record<WorkflowTool, string> = {
  document_checklist: '일정, 담당, 준비물, 확인 항목 순으로 체크리스트를 만드세요.',
  trip_plan: '일정, 인솔자 역할, 준비물, 비상 절차, 귀교 확인 순으로 운영표를 만드세요. 학생 실명이나 의료 정보는 쓰지 마세요.',
  meeting_notes: '결정 사항, 담당 업무, 마감일 순으로 회의 메모를 정리하세요. 참석자 실명과 학생 정보는 쓰지 마세요.',
}

export function workflowPrompt(tool: WorkflowTool, source: string): string {
  return `특수학교 교직원용 업무 문서를 정리합니다. ${INSTRUCTIONS[tool]}\n\n원문:\n${source}\n\n다음 JSON 형식으로만 답하세요:\n{"result":"검토용 문서"}`
}
