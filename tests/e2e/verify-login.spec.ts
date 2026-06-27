// Temporary verification spec — login then check nickname + sidebar without manual refresh.
// Remove after verification.
import { expect, test } from '@playwright/test'

test('login → home shows nickname + sidebar (no manual refresh)', async ({ page }) => {
  // 1. Unauthenticated / should redirect to /auth/login
  await page.goto('/')
  await expect(page).toHaveURL(/\/auth\/login$/)
  await expect(page.getByRole('heading', { name: '欢迎登录' })).toBeVisible()

  // 2. Sign in as admin / admin123 and wait for navigation to /
  await page.getByLabel('账号').fill('admin')
  await page.getByLabel('密码').fill('admin123')
  await page.getByRole('button', { name: '登录' }).click()
  await page.waitForURL((url) => new URL(url).pathname === '/', { timeout: 10000 })
  await page.waitForLoadState('networkidle')

  // 3. Home header should show admin's displayName immediately (no manual refresh)
  await expect(page.locator('main h1').first()).toContainText('管理员')
  await expect(page.locator('main h1').first()).toContainText('欢迎回到知识库')

  // 4. Sidebar should show spaces (root loader now sees me=true, fetches navigation)
  const sidebar = page.locator('aside').first()
  await expect(sidebar).toContainText('产品知识库')
  await expect(sidebar).toContainText('工程知识库')

  // 5. Top nav should show the logged-in user's displayName (not "登录" button)
  const topNav = page.locator('header').first()
  await expect(topNav).toContainText('管理员')
  await expect(topNav.getByRole('link', { name: '登录' })).toHaveCount(0)
})
