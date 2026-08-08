import { test, expect } from '../../lib/auth-fixture';

test.describe('Settings Visual', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/#settings', { waitUntil: 'load', timeout: 15000 });
    await page.waitForTimeout(2000);
  });

  test('settings matches baseline', async ({ page }) => {
    await expect(page).toHaveScreenshot('settings.png', {
      maxDiffPixels: 2000,
      caret: 'hide',
      animations: 'disabled',
    });
  });
});