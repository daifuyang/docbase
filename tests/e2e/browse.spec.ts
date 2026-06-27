import { expect, test } from '@playwright/test'

test.describe('US1: 知识库访问控制', () => {
  test('home page redirects anonymous users to login', async ({ page }) => {
    await page.goto('/')
    await expect(page).toHaveTitle(/DocBase/)
    await expect(page).toHaveURL(/\/auth\/login/)
    await expect(page.getByRole('heading', { name: '登录' })).toBeVisible()
  })

  test('home page returns a login page without credentials', async ({ page }) => {
    const response = await page.goto('/')
    expect(response?.status()).toBe(200)
    await expect(page).toHaveURL(/\/auth\/login/)
  })
})
