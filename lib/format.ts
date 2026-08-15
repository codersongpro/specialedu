const WON = new Intl.NumberFormat('ko-KR')

export function formatWon(amount: number): string {
  return `${WON.format(amount)}원`
}
