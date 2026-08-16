type StaffMember = {
  id: string
  name: string
  employment: 'full_time' | 'fixed_term' | 'part_time' | 'assistant'
}

type RankedCandidate = {
  candidate: { teacherId: string }
  score: number
  isPaid: boolean
}

export function manualAssignmentOptions(
  staff: readonly StaffMember[],
  ranked: readonly RankedCandidate[],
): Array<{ teacherId: string; name: string; isAvailable: boolean; isPaid: boolean }> {
  const detailsByTeacherId = new Map(ranked.map((candidate) => [candidate.candidate.teacherId, candidate]))

  return [...staff]
    .sort((a, b) => a.name.localeCompare(b.name, 'ko'))
    .map((member) => {
      const details = detailsByTeacherId.get(member.id)
      return {
        teacherId: member.id,
        name: member.name,
        isAvailable: Boolean(details),
        isPaid: details?.isPaid ?? false,
      }
    })
}

export function manualAssignmentDetails(
  teacherId: string,
  ranked: readonly RankedCandidate[],
): { score: number; isPaid: boolean } | null {
  const selected = ranked.find((candidate) => candidate.candidate.teacherId === teacherId)
  return selected ? { score: selected.score, isPaid: selected.isPaid } : null
}
