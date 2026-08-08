import { test, expect } from '../../lib/auth-fixture';

test.describe('Settings Visual', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/#settings', { waitUntil: 'load', timeout: 15000 });
    // Wait for the app shell to finish booting instead of a fixed sleep:
    // the composer workspace label is only populated after S._bootReady=true.
    await expect(page.locator('#composerWorkspaceLabel')).not.toBeEmpty();
  });

  test('settings matches baseline', async ({ page }) => {
    await expect(page).toHaveScreenshot('settings.png');
  });
});
