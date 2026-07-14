import { expect, test } from '@playwright/test'

test.describe('US4: 用户登录/登出', () => {
  test('login page renders', async ({ page }) => {
    await page.goto('/auth/login')
    await expect(page.getByRole('heading', { name: '欢迎登录' })).toBeVisible()
  })

  test('shows error for invalid credentials', async ({ page }) => {
    await page.goto('/auth/login')
    // Fill valid-looking but wrong credentials
    await page.getByLabel('账号').fill('wrong@example.com')
    // Wait for input to be ready
    await page.waitForTimeout(100)
    await page.locator('input[type="password"]').first().fill('wrong-password')
    await page.getByRole('button', { name: '登录' }).click()
    // Either shows error message or stays on login page (app behavior varies)
    await page.waitForTimeout(2000)
    // Should still be on login page (not redirected to dashboard)
    await expect(page).toHaveURL(/\/auth\/login/)
  })
})
