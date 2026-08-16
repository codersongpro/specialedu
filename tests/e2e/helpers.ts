import type { Page } from '@playwright/test'
import { DEMO_PASSWORD } from './demo-accounts'

/** 이메일·비밀번호로 로그인하고 대시보드까지 이동을 기다린다. */
export async function loginAs(page: Page, email: string): Promise<void> {
  await page.goto('/login')
  await page.locator('#email').fill(email)
  await page.locator('#password').fill(DEMO_PASSWORD)
  await page.getByRole('button', { name: '로그인' }).click()
  await page.waitForURL('**/dashboard', { timeout: 15_000 })
}
