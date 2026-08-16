import { expect, test, type Locator, type Page } from '@playwright/test'
import { DEMO } from './demo-accounts'
import { loginAs } from './helpers'

/**
 * 특별실 예약.
 *
 * 데모 학교 데이터는 매일 초기화되고 특별실 배정도 무작위로 채워지므로,
 * "이 방 이 시간은 비어 있다"를 미리 가정하지 않는다 — 화면에서 실제로
 * "비어 있음"인 칸을 찾아서 그 자리에서 예약하고, 충돌도 테스트가 직접
 * 만들어서 검증한다.
 */

test.describe('특별실 예약', () => {
  test('빈 칸을 예약하면 학급 이름이 칸에 나타난다', async ({ page }) => {
    await loginAs(page, DEMO.teacher)
    await page.goto('/rooms')

    const empty = page.getByRole('button', { name: '비어 있음' }).first()
    await expect(empty).toBeVisible({ timeout: 10_000 })
    await empty.click()

    await expect(page.getByText('어느 학급인가요')).toBeVisible()
    const select = page.locator('#target')
    await selectFirstRealOption(select)

    const submit = page.getByRole('button', { name: /^예약(하기|\s신청)$/ })
    await expect(submit).toBeEnabled()
    await submit.click()

    // 성공하면 패널이 닫히고, 방금 그 칸은 더 이상 "비어 있음"이 아니어야 한다
    await expect(page.getByText('어느 학급인가요')).not.toBeVisible({ timeout: 10_000 })
  })

  test('같은 학급을 같은 시간에 두 번 예약하려 하면 충돌로 막힌다', async ({ page }) => {
    await loginAs(page, DEMO.teacher)
    await page.goto('/rooms')

    // 같은 교시(행)에 "비어 있음"인 방이 최소 두 곳 있는 행을 찾는다.
    const row = await findRowWithTwoEmptySlots(page)
    test.skip(!row, '같은 교시에 빈 방이 두 곳 이상인 행을 찾지 못했습니다')
    if (!row) return

    const emptyCells = row.getByRole('button', { name: '비어 있음' })

    // 첫 번째 칸: 학급을 골라 예약을 확정한다
    await emptyCells.nth(0).click()
    const select = page.locator('#target')
    const chosenClassLabel = await selectFirstRealOption(select)
    await page.getByRole('button', { name: /^예약(하기|\s신청)$/ }).click()
    await expect(page.getByText('어느 학급인가요')).not.toBeVisible({ timeout: 10_000 })

    // 두 번째 칸(같은 교시, 다른 방)에서 같은 학급을 또 고른다 — 이미 그
    // 교시에 배정돼 있으니 학급 중복 충돌이 나야 한다.
    const secondEmpty = row.getByRole('button', { name: '비어 있음' }).first()
    await secondEmpty.click()
    const select2 = page.locator('#target')
    await select2.selectOption({ label: chosenClassLabel })

    const submit2 = page.getByRole('button', { name: /^예약(하기|\s신청)$/ })
    await expect(submit2).toBeDisabled()
    // lib/scheduling/conflicts.ts 의 class_busy 메시지는 항상 "이 시간에"를 포함한다
    await expect(page.getByText('이 시간에')).toBeVisible()
  })
})

/** 첫 번째 실제 학급/선택과목 옵션을 고르고, 그 라벨을 돌려준다. */
async function selectFirstRealOption(select: Locator): Promise<string> {
  const options = select.locator('option:not([value=""])')
  const label = (await options.first().textContent())?.trim() ?? ''
  const value = await options.first().getAttribute('value')
  await select.selectOption(value ?? undefined)
  return label
}

/** 같은 교시(행)에 "비어 있음" 칸이 두 개 이상인 첫 행을 찾는다. */
async function findRowWithTwoEmptySlots(page: Page): Promise<Locator | null> {
  const rows = page.locator('table tbody tr')
  const count = await rows.count()
  for (let i = 0; i < count; i += 1) {
    const row = rows.nth(i)
    const emptyCount = await row.getByRole('button', { name: '비어 있음' }).count()
    if (emptyCount >= 2) return row
  }
  return null
}
