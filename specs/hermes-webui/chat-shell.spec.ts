import { test, expect } from '../../lib/auth-fixture';

test.describe('Chat Shell Visual', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/', { waitUntil: 'load', timeout: 15000 });
    await page.waitForTimeout(2000);
  });

  test('chat-shell matches baseline', async ({ page }) => {
    await expect(page).toHaveScreenshot('chat-shell.png', {
      maxDiffPixels: 2000,
      caret: 'hide',
      animations: 'disabled',
    });
  });
});