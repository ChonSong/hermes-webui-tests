import { test, expect } from '../lib/auth-fixture';

test.describe('Hermes Desktop', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/', { waitUntil: 'load', timeout: 15000 });
    await page.waitForTimeout(3000);
  });

  test('05.01: Desktop extension globals are loaded', async ({ page }) => {
    const loaded = await page.evaluate(() => typeof (window as any).__HERMES_DESKTOP_LOADED__ !== 'undefined');
    expect(loaded).toBe(true);

    const hasDesktopCompanion = await page.evaluate(() => typeof (window as any)._getDesktopCompanionStatusGlobal === 'function');
    expect(hasDesktopCompanion).toBe(true);
  });

  test('05.02: Desktop panel element exists in DOM', async ({ page }) => {
    const panel = await page.evaluate(() => {
      const el = document.getElementById('hermes-desktop-panel');
      if (!el) return { found: false };
      const s = window.getComputedStyle(el);
      return { found: true, display: s.display };
    });
    expect(panel.found).toBe(true);
    console.log(`Desktop panel display: ${panel.display}`);
  });

  test('05.03: FAC toggle z-index is measured (collision documentation)', async ({ page }) => {
    // FAC toggle z-index
    const facZIndex = await page.evaluate(() => {
      const el = document.querySelector('#hwx-fac-toggle, [data-ext="fun-audio-chat"] .toggle-btn, .fac-toggle');
      if (!el) return null;
      return parseInt(window.getComputedStyle(el as HTMLElement).zIndex, 10);
    });

    // Desktop panel z-index
    const desktopZIndex = await page.evaluate(() => {
      const el = document.getElementById('hermes-desktop-panel');
      if (!el) return null;
      return parseInt(window.getComputedStyle(el).zIndex, 10);
    });

    if (facZIndex !== null) {
      console.log(`FAC toggle z-index: ${facZIndex}`);
    }
    if (desktopZIndex !== null) {
      console.log(`Desktop panel z-index: ${desktopZIndex}`);
    }
    // FAC uses 2147483647 (supremum) — desktop is blocked
    console.log(`Collision status: ${facZIndex !== null && desktopZIndex !== null && desktopZIndex < facZIndex ? 'COLLISION: FAC blocks desktop' : 'No measurable collision'}`);
    expect(facZIndex).toBe(2147483647);
  });
});
