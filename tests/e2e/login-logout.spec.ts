import { expect, test } from '@playwright/test'

test.describe('US4: 用户登录/登出', () => {
  test('login page renders', async ({ page }) => {
    await page.goto('/auth/login')
    await expect(page.getByRole('heading', { name: '欢迎登录' })).toBeVisible()
  })

  test('rejects wrong credentials', async ({ page }) => {
    await page.goto('/auth/login')
    await page.getByLabel('账号').fill('wrong@example.com')
    await page.getByLabel('密码').fill('wrong-password')
    await page.getByRole('button', { name: '登录' }).click()
    await expect(page.getByText('账号或密码错误')).toBeVisible({ timeout: 5000 })
  })
})
