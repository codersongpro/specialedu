import { expect, test } from '@playwright/test'
import { DEMO } from './demo-accounts'
import { loginAs } from './helpers'

test.describe('학사일정', () => {
  test('전교 행사를 등록하면 목록에 나타난다', async ({ page }) => {
    await loginAs(page, DEMO.teacher)
    await page.goto('/calendar')

    await page.getByRole('button', { name: '행사 넣기' }).click()

    const title = `e2e 테스트 행사 ${Date.now()}`
    await page.locator('#title').fill(title)
    // 기본값(scope=전교)을 그대로 쓴다 — 추가 필드가 필요 없다
    await page.getByRole('button', { name: '등록' }).click()

    await expect(page.getByText('등록했습니다')).toBeVisible({ timeout: 10_000 })
    // 모달이 자동으로 닫힌 뒤 캘린더 목록에 방금 넣은 행사가 보여야 한다
    await expect(page.getByText(title)).toBeVisible({ timeout: 10_000 })
  })

  test('아무것도 입력하지 않고 닫아도 등록되지 않는다', async ({ page }) => {
    await loginAs(page, DEMO.teacher)
    await page.goto('/calendar')

    await page.getByRole('button', { name: '행사 넣기' }).click()
    await expect(page.locator('#title')).toBeVisible()
    await page.getByRole('button', { name: '닫기' }).click()

    await expect(page.locator('#title')).not.toBeVisible()
  })
})
