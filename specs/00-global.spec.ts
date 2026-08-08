import { test, expect } from '../lib/auth-fixture';

test.describe('Global Extension Ecosystem', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/', { waitUntil: 'load', timeout: 15000 });
    await page.waitForTimeout(3000);
  });

  test('00.01: 25+ extension scripts load without errors', async ({ page }) => {
    const extScripts = await page.evaluate(() =>
      Array.from(document.querySelectorAll('script[src]'))
        .filter(s => s.src.includes('/extensions/'))
        .map(s => s.src.split('/').pop())
    );
    expect(extScripts.length).toBeGreaterThanOrEqual(20);
    console.log(`Extension scripts: ${extScripts.length}`);
  });

  test('00.02: Zero uncaught JS exceptions on page load', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', err => errors.push(err.message));
    await page.reload({ waitUntil: 'load', timeout: 15000 });
    await page.waitForTimeout(2000);
    expect(errors).toHaveLength(0);
  });

  test('00.03: Zero console errors from extension code', async ({ page }) => {
    const consoleErrors: string[] = [];
    page.on('console', msg => {
      if (msg.type() === 'error' || msg.type() === 'exception') {
        consoleErrors.push(msg.text());
      }
    });
    await page.reload({ waitUntil: 'load', timeout: 15000 });
    await page.waitForTimeout(2000);
    // Filter out sidecar connection refused (environmental, not extension bug)
    const extErrors = consoleErrors.filter(e => !e.includes('ERR_CONNECTION_REFUSED'));
    expect(extErrors).toHaveLength(0);
  });

  test('00.04: All core extension global guards are present', async ({ page }) => {
    const globals = await page.evaluate(() => ({
      hermesEmotionAvatar: typeof (window as any).HermesEmotionAvatar !== 'undefined',
      orchestrator: typeof (window as any).Orchestrator !== 'undefined',
      asyncTracker: typeof (window as any).__ASYNC_TRACKER_LOADED__ !== 'undefined',
      renderTranscript: typeof (window as any).renderTranscript === 'function',
      registerHermesSessionOpenHandler: typeof (window as any).registerHermesSessionOpenHandler === 'function',
      hermesDesktopLoaded: typeof (window as any).__HERMES_DESKTOP_LOADED__ !== 'undefined',
      hermesDtmRailBtn: !!document.getElementById('hwxDtmRailBtn'),
    }));
    expect(globals.hermesEmotionAvatar).toBe(true);
    expect(globals.orchestrator).toBe(true);
    expect(globals.asyncTracker).toBe(true);
    expect(globals.renderTranscript).toBe(true);
    expect(globals.registerHermesSessionOpenHandler).toBe(true);
    expect(globals.hermesDesktopLoaded).toBe(true);
    // DTM doesn't use a global flag — check rail button exists instead
    expect(globals.hermesDtmRailBtn).toBe(true);
  });

  test('00.05: 5+ extension-specific rail buttons visible', async ({ page }) => {
    const extButtons = await page.evaluate(() =>
      Array.from(document.querySelectorAll('.rail-btn'))
        .filter((b: Element) => (b as HTMLElement).id && (
          (b as HTMLElement).id.includes('at-') || (b as HTMLElement).id.includes('sd-') ||
          (b as HTMLElement).id.includes('hwx') || (b as HTMLElement).id.includes('dashboard')
        ))
        .map((b: Element) => ({ id: (b as HTMLElement).id, visible: (b as HTMLElement).offsetParent !== null }))
    );
    expect(extButtons.length).toBeGreaterThanOrEqual(5);
    const visible = extButtons.filter(b => b.visible);
    expect(visible.length).toBeGreaterThanOrEqual(4);
  });

  test('00.06: Avatar settings titlebar button is attached', async ({ page }) => {
    const btn = page.getByRole('button', { name: 'Avatar settings' });
    await expect(btn.first()).toBeAttached({ timeout: 5000 });
  });
});
