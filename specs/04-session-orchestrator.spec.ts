import { test, expect } from '../lib/auth-fixture';

test.describe('Session Orchestrator', () => {
  test.beforeEach(async ({ page }) => {
    page.on('pageerror', err => console.error(`[PAGE_ERROR] ${err.message}`));
    await page.goto('/', { waitUntil: 'load', timeout: 15000 });
    await page.waitForTimeout(3000);
  });

  test('04.01: Orchestrator object exists with all expected methods', async ({ page }) => {
    const api = await page.evaluate(() => {
      const o = (window as any).Orchestrator;
      if (!o) return null;
      const methods = Object.getOwnPropertyNames(o).filter(k => typeof o[k] === 'function');
      return { methods, ownKeys: Object.getOwnPropertyNames(o) };
    });
    expect(api).not.toBeNull();
    const expectedMethods = ['parseCommand', 'execCommand', 'registerAlias', 'unregisterAlias',
                      'toggle', 'speak'];
    for (const m of expectedMethods) {
      expect(api!.methods).toContain(m);
    }
    // Verify enabled exists as a property (getter)
    expect(api!.ownKeys).toContain('enabled');
  });

  test('04.02: parseCommand accepts slash-prefixed string without throwing', async ({ page }) => {
    for (const cmd of ['help', 'status', 'alias', 'context', 'go', 'focus', 'split', 'regroup', 'undo']) {
      const threw = await page.evaluate((c: string) => {
        try {
          (window as any).Orchestrator.parseCommand(`/${c}`);
          return false;
        } catch (e: any) {
          return true;
        }
      }, cmd);
      expect(threw).toBe(false);
    }
  });

  test('04.03: execCommand works without throwing for built-in commands', async ({ page }) => {
    for (const cmd of ['help', 'status', 'undo']) {
      const threw = await page.evaluate((c: string) => {
        try {
          (window as any).Orchestrator.execCommand(c);
          return false;
        } catch (e: any) {
          return true;
        }
      }, cmd);
      expect(threw).toBe(false);
    }
  });

  test('04.04: Orchestrator has enabled property', async ({ page }) => {
    const state = await page.evaluate(() => {
      const o = (window as any).Orchestrator;
      return { hasEnabled: 'enabled' in o, enabledValue: o.enabled };
    });
    expect(state.hasEnabled).toBe(true);
  });

  test('04.05: Registering and unregistering an alias works', async ({ page }) => {
    // Register
    const regResult = await page.evaluate(() => {
      try {
        (window as any).Orchestrator.registerAlias('testalias', 'Test Alias');
        return { ok: true };
      } catch (e: any) {
        return { ok: false, error: e.message };
      }
    });
    expect(regResult.ok).toBe(true);

    // Unregister
    const unregResult = await page.evaluate(() => {
      try {
        (window as any).Orchestrator.unregisterAlias('testalias');
        return { ok: true };
      } catch (e: any) {
        return { ok: false, error: e.message };
      }
    });
    expect(unregResult.ok).toBe(true);
  });

  test('04.06: Toggle method is callable', async ({ page }) => {
    const threw = await page.evaluate(() => {
      try {
        (window as any).Orchestrator.toggle();
        return false;
      } catch (e: any) {
        return true;
      }
    });
    expect(threw).toBe(false);
  });
});
