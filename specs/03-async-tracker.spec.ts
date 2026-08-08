import { test, expect } from '../lib/auth-fixture';

test.describe('Async Tracker', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/', { waitUntil: 'load', timeout: 15000 });
    await page.waitForTimeout(3000);
  });

  test('03.01: Rail button exists and is visible', async ({ page }) => {
    const btn = page.locator('#at-rail-btn');
    await expect(btn).toBeVisible({ timeout: 5000 });
    await expect(btn).toHaveAttribute('title', 'Async Tracker');
  });

  test('03.02: Clicking rail button shows panelAsyncTracker', async ({ page }) => {
    await page.locator('#at-rail-btn').click();
    const panel = page.locator('#panelAsyncTracker');
    await expect(panel).toBeVisible({ timeout: 5000 });
    await expect(panel).toHaveClass(/active/);
  });

  test('03.03: Panel contains tree, graph, and log sections', async ({ page }) => {
    await page.locator('#at-rail-btn').click();
    await page.waitForTimeout(1000);

    await expect(page.locator('#at-tree')).toBeVisible();
    await expect(page.locator('#at-dependency')).toBeVisible();
    await expect(page.locator('#at-log-list')).toBeVisible();
  });

  test('03.04: Toggle closes panel', async ({ page }) => {
    const btn = page.locator('#at-rail-btn');

    // Open
    await btn.click();
    await expect(page.locator('#panelAsyncTracker')).toBeVisible();
    await expect(page.locator('#panelAsyncTracker')).toHaveClass(/active/);

    // Close
    await btn.click();
    await page.waitForTimeout(500);
    const active = await page.evaluate(() => {
      const p = document.getElementById('panelAsyncTracker');
      return p ? p.classList.contains('active') : false;
    });
    expect(active).toBe(false);
  });
});
