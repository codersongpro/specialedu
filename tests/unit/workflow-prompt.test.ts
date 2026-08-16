import { describe, expect, it } from 'vitest'
import { workflowPrompt } from '@/lib/workflow/prompt'

describe('workflowPrompt', () => {
  it('returns only the requested checklist sections for a document', () => {
    const prompt = workflowPrompt('document_checklist', '연수는 8월 20일, 준비물은 노트북입니다.')
    expect(prompt).toContain('일정')
    expect(prompt).toContain('담당')
    expect(prompt).toContain('준비물')
    expect(prompt).toContain('확인 항목')
    expect(prompt).not.toContain('학생 진단명')
  })

  it('requests structured decisions and deadlines for meeting notes', () => {
    const prompt = workflowPrompt('meeting_notes', '운영회의: 교실 정비는 금요일까지')
    expect(prompt).toContain('결정 사항')
    expect(prompt).toContain('담당 업무')
    expect(prompt).toContain('마감일')
  })
})
