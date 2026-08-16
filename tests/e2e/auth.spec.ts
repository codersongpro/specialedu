import { expect, test } from '@playwright/test'
import { DEMO } from './demo-accounts'
import { loginAs } from './helpers'

test.describe('로그인', () => {
  test('데모 교사 계정으로 로그인하면 대시보드로 이동한다', async ({ page }) => {
    await loginAs(page, DEMO.teacher)
    await expect(page).toHaveURL(/\/dashboard/)
    // 로그인한 사람 것으로 보이는 화면 요소가 실제로 그려졌는지까지 확인한다
    // (리다이렉트만 되고 화면이 빈 채로 남는 사고를 잡기 위함). 사이드바
    // 메뉴는 데스크톱·모바일 두 벌이 함께 DOM에 있으므로 첫 번째만 본다.
    await expect(page.locator('nav').first()).toBeVisible()
  })

  test('비밀번호가 틀리면 거부하고 계정 존재 여부를 알려주지 않는다', async ({ page }) => {
    await page.goto('/login')
    await page.locator('#email').fill(DEMO.teacher)
    await page.locator('#password').fill('wrong-password-xyz')
    await page.getByRole('button', { name: '로그인' }).click()

    await expect(page.getByRole('alert')).toContainText('이메일 또는 비밀번호가 맞지 않습니다')
    await expect(page).toHaveURL(/\/login/)
  })

  test('로그아웃하면 다시 로그인 화면으로 돌아가고, 보호된 화면은 로그인으로 튕긴다', async ({
    page,
  }) => {
    await loginAs(page, DEMO.teacher)
    // 로그아웃 버튼도 데스크톱·모바일 사이드바 두 벌 중 첫 번째(보이는 쪽)를 누른다
    await page.getByRole('button', { name: '로그아웃' }).first().click()
    await expect(page).toHaveURL(/\/login/)

    await page.goto('/dashboard')
    await expect(page).toHaveURL(/\/login/)
  })
})
