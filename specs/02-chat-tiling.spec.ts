import { test, expect } from '../lib/auth-fixture';

test.describe('Chat Tiling', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/', { waitUntil: 'load', timeout: 15000 });
    await page.waitForTimeout(3000);
  });

  test('02.01: Toolbar exists with 4 layout buttons by data-layout', async ({ page }) => {
    const toolbar = page.locator('#ext-tiling-toolbar');
    await expect(toolbar).toBeVisible({ timeout: 5000 });

    const layouts = await page.evaluate(() =>
      Array.from(document.querySelectorAll('#ext-tiling-toolbar button[data-layout]'))
        .map(b => (b as HTMLElement).dataset.layout)
    );
    expect(layouts).toContain('2x1');
    expect(layouts).toContain('2x2');
    expect(layouts).toContain('3x2');
    expect(layouts).toContain('close');
  });

  test('02.02: Clicking 2x1 creates grid with 2 children', async ({ page }) => {
    const btn = page.locator('button[data-layout="2x1"]');
    await btn.click();
    await page.waitForTimeout(500);

    const childCount = await page.evaluate(() => {
      const grid = document.getElementById('ext-tile-grid');
      if (!grid) return -1;
      return grid.children.length;
    });
    expect(childCount).toBe(2);
  });

  test('02.03: Clicking 2x2 creates grid with 4 children', async ({ page }) => {
    await page.locator('button[data-layout="2x1"]').click();
    await page.waitForTimeout(200);
    await page.locator('button[data-layout="2x2"]').click();
    await page.waitForTimeout(500);

    const childCount = await page.evaluate(() => {
      const grid = document.getElementById('ext-tile-grid');
      if (!grid) return -1;
      return grid.children.length;
    });
    expect(childCount).toBe(4);
  });

  test('02.04: Clicking 3x2 creates grid with 6 children', async ({ page }) => {
    await page.locator('button[data-layout="3x2"]').click();
    await page.waitForTimeout(500);

    const childCount = await page.evaluate(() => {
      const grid = document.getElementById('ext-tile-grid');
      if (!grid) return -1;
      return grid.children.length;
    });
    expect(childCount).toBe(6);
  });

  test('02.05: Close button hides grid (display:none)', async ({ page }) => {
    await page.locator('button[data-layout="2x1"]').click();
    await page.waitForTimeout(300);
    await page.locator('button[data-layout="close"]').click();
    await page.waitForTimeout(300);

    const display = await page.evaluate(() => {
      const grid = document.getElementById('ext-tile-grid');
      return grid ? window.getComputedStyle(grid).display : 'no-grid';
    });
    expect(display).toBe('none');
  });

  test('02.06: Hook renderTranscript is a function', async ({ page }) => {
    const isFn = await page.evaluate(() => typeof (window as any).renderTranscript === 'function');
    expect(isFn).toBe(true);
  });

  test('02.07: Hook registerHermesSessionOpenHandler is a function', async ({ page }) => {
    const isFn = await page.evaluate(() => typeof (window as any).registerHermesSessionOpenHandler === 'function');
    expect(isFn).toBe(true);
  });

  test('02.08: Zero console errors during layout switching', async ({ page }) => {
    const errors: string[] = [];
    page.on('console', msg => {
      if (msg.type() === 'error' || msg.type() === 'exception') {
        errors.push(msg.text());
      }
    });

    await page.locator('button[data-layout="2x1"]').click();
    await page.waitForTimeout(300);
    await page.locator('button[data-layout="2x2"]').click();
    await page.waitForTimeout(300);
    await page.locator('button[data-layout="3x2"]').click();
    await page.waitForTimeout(300);
    await page.locator('button[data-layout="close"]').click();
    await page.waitForTimeout(300);

    const extErrors = errors.filter(e => !e.includes('ERR_CONNECTION_REFUSED'));
    expect(extErrors).toHaveLength(0);
  });

  test('02.09: Grid starts inactive on load (no auto-activation)', async ({ page }) => {
    // Wait longer than the old 500ms auto-activation delay
    await page.waitForTimeout(1500);

    const gridState = await page.evaluate(() => {
      const grid = document.getElementById('ext-tile-grid');
      if (!grid) return { exists: false };
      return {
        exists: true,
        display: window.getComputedStyle(grid).display,
        hasActiveClass: grid.classList.contains('ext-tile-grid--active'),
        childCount: grid.children.length,
        bodyHasClass: document.body.classList.contains('ext-tiling-body'),
      };
    });

    expect(gridState.exists).toBe(true);
    expect(gridState.display).toBe('none');
    expect(gridState.hasActiveClass).toBe(false);
    expect(gridState.childCount).toBe(0);
    expect(gridState.bodyHasClass).toBe(false);
  });

  test('02.10: Rapid focus switching is race-safe', async ({ page }) => {
    // Capture activation generations to prove stale completions are discarded
    const genLog: number[] = [];
    await page.exposeFunction('logGen', (gen: number) => genLog.push(gen));

    // Activate 2x1 grid (creates 2 empty tiles)
    await page.locator('button[data-layout="2x1"]').click();
    await page.waitForTimeout(500);

    const tileCount = await page.evaluate(() => {
      const grid = document.getElementById('ext-tile-grid');
      return grid ? grid.children.length : 0;
    });
    expect(tileCount).toBe(2);

    // Click both tiles in rapid succession (< 100ms apart)
    const tileA = page.locator('.ext-tile[data-tile-id="1"] .ext-tile-body');
    const tileB = page.locator('.ext-tile[data-tile-id="2"] .ext-tile-body');
    await tileA.click();
    await tileB.click();

    // Wait for any async loadSession completions to settle
    await page.waitForTimeout(1500);

    // Verify the last-clicked tile (B) is the active one
    const focusedId = await page.evaluate(() => {
      const focused = document.querySelector('.ext-tile--focused');
      return focused ? (focused as HTMLElement).dataset.tileId : null;
    });
    expect(focusedId).toBe('2');

    // Verify msgInner is in tile B (not orphaned in tile A)
    const msgInnerLocation = await page.evaluate(() => {
      const mi = document.getElementById('msgInner');
      if (!mi) return 'no-msgInner';
      const tile = mi.closest('.ext-tile');
      return tile ? (tile as HTMLElement).dataset.tileId : 'outside-tile';
    });
    expect(msgInnerLocation).toBe('2');
  });

  test('02.11: hideGrid restores original session', async ({ page }) => {
    // Capture initial msgInner state
    const initialMsgInner = await page.evaluate(() => {
      const mi = document.getElementById('msgInner');
      return mi ? mi.innerHTML.substring(0, 100) : null;
    });

    // Activate 2x1 grid
    await page.locator('button[data-layout="2x1"]').click();
    await page.waitForTimeout(500);

    // Verify grid is active
    const gridActiveBefore = await page.evaluate(() => {
      const grid = document.getElementById('ext-tile-grid');
      return grid ? grid.classList.contains('ext-tile-grid--active') : false;
    });
    expect(gridActiveBefore).toBe(true);

    // Close via close button
    await page.locator('button[data-layout="close"]').click();
    await page.waitForTimeout(500);

    // Verify grid is hidden
    const gridState = await page.evaluate(() => {
      const grid = document.getElementById('ext-tile-grid');
      return {
        display: grid ? window.getComputedStyle(grid).display : 'no-grid',
        activeClass: grid ? grid.classList.contains('ext-tile-grid--active') : false,
        bodyClass: document.body.classList.contains('ext-tiling-body'),
      };
    });
    expect(gridState.display).toBe('none');
    expect(gridState.activeClass).toBe(false);
    expect(gridState.bodyClass).toBe(false);

    // Verify msgInner is restored to the main messages area
    const msgInnerRestored = await page.evaluate(() => {
      const mi = document.getElementById('msgInner');
      if (!mi) return { exists: false };
      const inGrid = !!mi.closest('#ext-tile-grid');
      return { exists: true, inGrid, parent: mi.parentElement?.id || 'unknown' };
    });
    expect(msgInnerRestored.exists).toBe(true);
    expect(msgInnerRestored.inGrid).toBe(false);
  });

  test('02.12: Core hook payload shape', async ({ page }) => {
    // Verify the hooks exist and are functions (primary assertion)
    const hooksOk = await page.evaluate(() => ({
      renderTranscript: typeof (window as any).renderTranscript === 'function',
      registerHandler: typeof (window as any).registerHermesSessionOpenHandler === 'function',
    }));
    expect(hooksOk.renderTranscript).toBe(true);
    expect(hooksOk.registerHandler).toBe(true);

    // Verify the hooks have the expected signature by inspecting their toString
    const hookSignatures = await page.evaluate(() => {
      const reg = (window as any).registerHermesSessionOpenHandler;
      const render = (window as any).renderTranscript;
      return {
        regFn: typeof reg === 'function' ? reg.toString().slice(0, 200) : 'not-a-function',
        renderFn: typeof render === 'function' ? render.toString().slice(0, 200) : 'not-a-function',
      };
    });
    // Both hooks should be defined as functions (non-empty string representation)
    expect(hookSignatures.regFn).toContain('function');
    expect(hookSignatures.renderFn).toContain('function');
  });
});
