import { test, expect } from '../../lib/auth-fixture';

test.describe('Sessions Visual', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/#sessions', { waitUntil: 'load', timeout: 15000 });
    await page.waitForTimeout(2000);
  });

  test('sessions matches baseline', async ({ page }) => {
    await expect(page).toHaveScreenshot('sessions.png', {
      maxDiffPixels: 2000,
      caret: 'hide',
      animations: 'disabled',
    });
  });
});