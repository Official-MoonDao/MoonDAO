import { expect, test } from '@playwright/test'

test('logged-out mobile dashboard shows a sign-in button', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto('/dashboard', { waitUntil: 'domcontentloaded' })

  const prompt = page.getByTestId('dashboard-sign-in-prompt')
  const button = page.getByTestId('dashboard-sign-in-button')
  await expect(prompt).toBeVisible()
  await expect(prompt).toContainText('Sign in to your dashboard')
  await expect(button).toBeVisible()
  await expect(button).toHaveText('Sign in')
  await expect(page).toHaveURL(/\/dashboard/)

  await page.screenshot({
    path: '/opt/cursor/artifacts/dashboard-logged-out-mobile.png',
    fullPage: true,
  })

  await button.click()
  await expect(page).toHaveURL(/\/dashboard/)
})
