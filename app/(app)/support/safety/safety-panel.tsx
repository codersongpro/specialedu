'use client'

import { useEffect, useMemo, useState, useTransition } from 'react'
import { Badge, Button, EmptyState, Field, inputClass } from '@/components/ui'
import { cn } from '@/lib/cn'
import { deleteProtocol, saveProtocol } from './actions'

export type SafetyCategory = 'seizure' | 'allergy' | 'dysphagia' | 'other'

const CATEGORY_LABEL: Record<SafetyCategory, string> = {
  seizure: '발작',
  allergy: '알레르기',
  dysphagia: '연하곤란',
  other: '기타',
}
const CATEGORY_TONE: Record<SafetyCategory, 'danger' | 'warn' | 'brand' | 'neutral'> = {
  seizure: 'danger',
  allergy: 'warn',
  dysphagia: 'brand',
  other: 'neutral',
}

export interface ProtocolItem {
  id: string
  studentId: string
  category: SafetyCategory
  title: string
  content: string
  updatedAt: string
}
export interface StudentGroup {
  studentId: string
  studentName: string
  className: string
  protocols: ProtocolItem[]
}
export interface StudentOption {
  id: string
  displayName: string
  className: string
}

export function SafetyPanel({
  groups,
  students,
  isAdmin,
}: {
  groups: StudentGroup[]
  students: StudentOption[]
  isAdmin: boolean
}) {
  const [query, setQuery] = useState('')
  const [formOpen, setFormOpen] = useState(false)
  const [expandedStudent, setExpandedStudent] = useState<string | null>(null)

  const filtered = useMemo(() => {
    const q = query.trim()
    if (!q) return groups
    return groups.filter((g) => g.studentName.includes(q) || g.className.includes(q))
  }, [groups, query])

  return (
    <div>
      <div className="flex flex-wrap items-center gap-2">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="학생 이름·학급으로 찾기"
          className={cn(inputClass, 'max-w-xs')}
        />
        {isAdmin ? (
          <Button variant="secondary" onClick={() => setFormOpen(true)}>
            프로토콜 추가
          </Button>
        ) : null}
      </div>

      {filtered.length === 0 ? (
        <div className="mt-4">
          <EmptyState
            title={groups.length === 0 ? '등록된 안전 프로토콜이 없습니다' : '검색 결과가 없습니다'}
            hint={isAdmin ? '위 버튼으로 학생별 응급 대응 절차를 등록하세요' : undefined}
          />
        </div>
      ) : (
        <ul className="mt-4 space-y-2">
          {filtered.map((group) => {
            const open = expandedStudent === group.studentId
            return (
              <li key={group.studentId} className="rounded-[14px] border border-line">
                <button
                  type="button"
                  onClick={() => setExpandedStudent(open ? null : group.studentId)}
                  className="flex w-full flex-wrap items-center gap-2 px-4 py-3 text-left"
                >
                  <span className="whitespace-nowrap text-[15px] font-medium">{group.studentName}</span>
                  <span className="whitespace-nowrap text-[13px] text-ink-soft">{group.className}</span>
                  <div className="flex flex-wrap gap-1.5">
                    {group.protocols.map((p) => (
                      <Badge key={p.id} tone={CATEGORY_TONE[p.category]}>
                        {CATEGORY_LABEL[p.category]}
                      </Badge>
                    ))}
                  </div>
                </button>

                {open ? (
                  <div className="space-y-3 border-t border-line px-4 py-3">
                    {group.protocols.map((p) => (
                      <ProtocolDetail key={p.id} protocol={p} isAdmin={isAdmin} />
                    ))}
                  </div>
                ) : null}
              </li>
            )
          })}
        </ul>
      )}

      {formOpen ? <ProtocolFormModal students={students} onClose={() => setFormOpen(false)} /> : null}
    </div>
  )
}

function ProtocolDetail({ protocol, isAdmin }: { protocol: ProtocolItem; isAdmin: boolean }) {
  const [pending, startTransition] = useTransition()
  const [removed, setRemoved] = useState(false)

  if (removed) return null

  return (
    <div className="rounded-lg bg-canvas p-3">
      <div className="flex flex-wrap items-center gap-2">
        <Badge tone={CATEGORY_TONE[protocol.category]}>{CATEGORY_LABEL[protocol.category]}</Badge>
        <span className="text-[14px] font-medium">{protocol.title}</span>
      </div>
      <p className="mt-1.5 whitespace-pre-wrap text-[14px] leading-relaxed">{protocol.content}</p>
      {isAdmin ? (
        <button
          type="button"
          disabled={pending}
          onClick={() =>
            startTransition(async () => {
              const result = await deleteProtocol(protocol.id)
              if (result.ok) setRemoved(true)
            })
          }
          className="mt-2 text-[12.5px] text-ink-soft underline hover:text-danger"
        >
          삭제
        </button>
      ) : null}
    </div>
  )
}

function ProtocolFormModal({ students, onClose }: { students: StudentOption[]; onClose: () => void }) {
  const [studentId, setStudentId] = useState(students[0]?.id ?? '')
  const [category, setCategory] = useState<SafetyCategory>('seizure')
  const [title, setTitle] = useState('')
  const [content, setContent] = useState('')
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [onClose])

  function submit() {
    startTransition(async () => {
      const result = await saveProtocol(null, { studentId, category, title, content })
      if (result.error) setError(result.error)
      else onClose()
    })
  }

  if (students.length === 0) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/40 px-4" onClick={onClose}>
        <div
          className="w-full max-w-sm rounded-[14px] border border-line bg-surface p-4"
          onClick={(e) => e.stopPropagation()}
        >
          <p className="text-[15px]">등록된 학생이 없습니다. 기준정보 관리에서 학생을 먼저 등록하세요.</p>
          <Button variant="secondary" className="mt-3" onClick={onClose}>
            닫기
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-ink/40 px-4 py-8 sm:items-center"
      onClick={onClose}
    >
      <div
        className="w-full max-w-sm rounded-[14px] border border-line bg-surface p-4 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-base font-semibold">프로토콜 추가</h2>
          <button
            type="button"
            onClick={onClose}
            className="-mr-2 -mt-1 rounded-lg px-2 py-1 text-[15px] text-ink-soft hover:bg-canvas"
          >
            닫기
          </button>
        </div>

        <div className="space-y-3">
          <Field label="학생" htmlFor="protocol-student">
            <select
              id="protocol-student"
              value={studentId}
              onChange={(e) => setStudentId(e.target.value)}
              className={inputClass}
            >
              {students.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.className} · {s.displayName}
                </option>
              ))}
            </select>
          </Field>

          <Field label="분류" htmlFor="protocol-category">
            <select
              id="protocol-category"
              value={category}
              onChange={(e) => setCategory(e.target.value as SafetyCategory)}
              className={inputClass}
            >
              {(Object.keys(CATEGORY_LABEL) as SafetyCategory[]).map((c) => (
                <option key={c} value={c}>
                  {CATEGORY_LABEL[c]}
                </option>
              ))}
            </select>
          </Field>

          <Field label="제목" htmlFor="protocol-title">
            <input id="protocol-title" value={title} onChange={(e) => setTitle(e.target.value)} maxLength={80} className={inputClass} />
          </Field>

          <Field label="대응 절차" htmlFor="protocol-content" hint="응급 상황에서 바로 따라 할 수 있게 순서대로 적어 주세요">
            <textarea
              id="protocol-content"
              value={content}
              onChange={(e) => setContent(e.target.value)}
              maxLength={1000}
              rows={5}
              className={cn(inputClass, 'h-auto py-2')}
            />
          </Field>

          {error ? <p className="text-[13.5px] text-danger">{error}</p> : null}

          <Button onClick={submit} disabled={pending || !title.trim() || !content.trim()} className="w-full">
            {pending ? '저장 중' : '저장'}
          </Button>
        </div>
      </div>
    </div>
  )
}
