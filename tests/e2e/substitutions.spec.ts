import { expect, test } from '@playwright/test'
import { DEMO } from './demo-accounts'
import { loginAs } from './helpers'

test.describe('결보강', () => {
  test('결과를 신청하면 보강 대상을 자동으로 찾는다', async ({ page }) => {
    await loginAs(page, DEMO.teacher)
    await page.goto('/substitutions')

    await page.getByRole('heading', { name: '결과 신청' }).scrollIntoViewIfNeeded()

    const today = new Date().toISOString().slice(0, 10)
    await page.locator('#startsOn').fill(today)
    await page.locator('#endsOn').fill(today)
    await page.getByRole('button', { name: '신청' }).click()

    // "보강이 필요한 수업 N개를 찾았습니다" 또는 "해당 기간에 잡힌 수업이
    // 없어 보강 대상은 없습니다" — 오늘 그 교사의 시간표에 수업이 있는지에
    // 따라 갈리므로 둘 다 "신청 자체는 성공했다"는 뜻으로 받아들인다
    await expect(
      page.getByText(/보강이 필요한 수업 \d+개를 찾았습니다|보강 대상은 없습니다/),
    ).toBeVisible({ timeout: 10_000 })
  })

  test('관리자는 후보를 보고 보강 교사를 정할 수 있다', async ({ page }) => {
    await loginAs(page, DEMO.admin)
    await page.goto('/substitutions')

    const assignButton = page.getByRole('button', { name: '보강 정하기' }).first()
    test.skip(
      (await assignButton.count()) === 0,
      '배정 대기 중인 결보강 건이 없습니다 (데모 데이터 상태에 따라 없을 수 있음)',
    )
    if ((await assignButton.count()) === 0) return

    await assignButton.click()

    const pickFirst = page.getByRole('button', { name: '이 분으로' }).first()
    if (await pickFirst.isVisible().catch(() => false)) {
      await pickFirst.click()
      // 배정되면 "해제" 버튼과 함께 이름 배지가 보인다
      await expect(page.getByRole('button', { name: '해제' }).first()).toBeVisible({
        timeout: 10_000,
      })
    } else {
      await expect(page.getByText('이 시간에 가능한 분이 없습니다')).toBeVisible()
    }
  })
})
