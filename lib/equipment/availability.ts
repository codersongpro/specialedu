/**
 * 교구 대여 — 재고 확인.
 *
 * 실제 강제는 DB 트리거(`check_equipment_capacity()`,
 * supabase/migrations/0017_equipment.sql)가 한다. 이 함수는 화면에서
 * 기간을 고를 때 "지금 남은 수량"을 미리 보여주는 힌트일 뿐이다 —
 * `lib/scheduling/conflicts.ts`가 방 충돌을 미리 보여주고 GIST exclude가
 * 최종 강제하는 것과 같은 이중 레이어 구조.
 *
 * 날짜는 Supabase가 돌려주는 `date` 컬럼 형식(YYYY-MM-DD)을 그대로 쓴다 —
 * 이 형식은 문자열 비교만으로도 날짜 순서와 일치한다.
 */

export interface EquipmentItem {
  id: string
  totalQuantity: number
}

export interface DateRange {
  startsOn: string
  endsOn: string
}

export interface EquipmentLoan extends DateRange {
  id: string
  itemId: string
  quantity: number
  returnedAt: string | null
}

function rangesOverlap(a: DateRange, b: DateRange): boolean {
  return a.startsOn <= b.endsOn && b.startsOn <= a.endsOn
}

/**
 * 주어진 기간에 아직 남아 있는 수량. 음수가 나올 수 있다 — 즉시 막지
 * 않고 "이미 초과된 상태"를 그대로 보여줘서 화면이 경고를 띄울 수 있게
 * 한다(실제 저장은 DB 트리거가 막으므로 안전).
 */
export function remainingQuantity(
  item: EquipmentItem,
  loans: readonly EquipmentLoan[],
  range: DateRange,
  excludeLoanId?: string,
): number {
  const used = loans
    .filter((loan) => loan.itemId === item.id)
    .filter((loan) => loan.returnedAt === null)
    .filter((loan) => loan.id !== excludeLoanId)
    .filter((loan) => rangesOverlap(loan, range))
    .reduce((sum, loan) => sum + loan.quantity, 0)

  return item.totalQuantity - used
}
