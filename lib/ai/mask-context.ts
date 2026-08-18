import 'server-only'

import { blockedFindings, maskPII, type Confidence, type PiiKind } from '@/lib/security/pii'
import { createClient } from '@/lib/supabase/server'

/**
 * easy-read/actions.ts 의 loadMaskContext()·미리보기 로직을 협의록·IEP 초안
 * 두 곳에서 그대로 다시 쓰기 위해 뽑아 둔 공용 헬퍼. easy-read 쪽 로컬
 * 복사본은 이미 동작 중이라 건드리지 않는다.
 */

export interface MaskContext {
  staffNames: string[]
  orgNames: string[]
}

export async function loadMaskContext(schoolId: string, schoolName: string): Promise<MaskContext> {
  const supabase = await createClient()
  const [{ data: staff }, { data: departments }] = await Promise.all([
    supabase.from('profiles').select('name').eq('school_id', schoolId),
    supabase.from('departments').select('name').eq('school_id', schoolId),
  ])
  return {
    staffNames: (staff ?? []).map((s) => s.name),
    orgNames: [schoolName, ...(departments ?? []).map((d) => d.name)],
  }
}

export interface MaskPreviewFinding {
  original: string
  kind: PiiKind
  confidence: Confidence
}

export interface MaskPreviewResult {
  masked: string
  findings: MaskPreviewFinding[]
  blocked: boolean
}

export function previewMaskText(text: string, ctx: MaskContext): MaskPreviewResult {
  if (!text.trim()) return { masked: '', findings: [], blocked: false }

  const result = maskPII(text, ctx)
  return {
    masked: result.masked,
    findings: result.findings.map((f) => ({
      original: f.original,
      kind: f.kind,
      confidence: f.confidence,
    })),
    blocked: blockedFindings(result.findings).length > 0,
  }
}
