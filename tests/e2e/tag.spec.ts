import { expect, test } from '@playwright/test'

test.describe('US8: 按标签筛选', () => {
  test('tag page returns 404 for non-existent tag', async ({ page }) => {
    const response = await page.goto('/tags/nonexistent-tag-zzz-9999')
    expect(response?.status()).toBe(404)
  })
})
