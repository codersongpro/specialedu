type ActiveLoan = {
  quantity: number
  returnedAt: string | null
}

export function availableEquipmentQuantity(totalQuantity: number, loans: ActiveLoan[]): number {
  const lentQuantity = loans.reduce(
    (sum, loan) => sum + (loan.returnedAt ? 0 : loan.quantity),
    0,
  )

  return Math.max(0, totalQuantity - lentQuantity)
}
