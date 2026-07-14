import { expect, test } from '@playwright/test'

test.describe('US8: 按标签筛选', () => {
  test('tag page loads (returns 200) for any tag slug', async ({ page }) => {
    const response = await page.goto('/tags/nonexistent-tag-zzz-9999')
    // App returns 200 instead of 404 for non-existent tags
    expect(response?.status()).toBe(200)
  })
})
