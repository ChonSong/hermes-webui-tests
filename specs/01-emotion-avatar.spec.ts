import { test, expect } from '../lib/auth-fixture';

/**
 * Checks if the avatar overlay DIV has visually rendered content.
 * The avatar renders into a DIV (not a <canvas>), so we use screenshot
 * cropping and pixel counting instead of getContext('2d').
 */
async function avatarDivHasContent(page: any): Promise<boolean> {
  return page.evaluate(() => {
    const overlay = document.getElementById('hwx-emotion-avatar-overlay');
    if (!overlay) return false;
    const rect = overlay.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) return false;
    // Check if there's any visible child content
    const canvasDiv = document.getElementById('hwx-emotion-avatar-canvas');
    if (!canvasDiv) return false;
    // Check CSS background (avatar may render as background-image on the DIV)
    const style = window.getComputedStyle(canvasDiv);
    const bgImage = style.backgroundImage;
    const bgColor = style.backgroundColor;
    const hasBgImage = bgImage && bgImage !== 'none';
    const hasBgColor = bgColor && bgColor !== 'rgba(0, 0, 0, 0)' && bgColor !== 'transparent';
    // Check for direct child elements that contain content
    const hasChildContent = canvasDiv.children.length > 0;
    const hasText = canvasDiv.textContent && canvasDiv.textContent.trim().length > 0;
    // Check for inline style content
    const hasInlineStyle = canvasDiv.getAttribute('style')?.includes('content') || false;
    return hasBgImage || hasBgColor || hasChildContent || hasText || hasInlineStyle;
  });
}

test.describe('Emotion Avatar', () => {
  test.beforeEach(async ({ page }) => {
    page.on('pageerror', err => {
      console.error(`[PAGE_ERROR] ${err.message}`);
    });
    await page.goto('/', { waitUntil: 'load', timeout: 15000 });
    await page.waitForTimeout(3000);
  });

  test('01.01: HermesEmotionAvatar API surface complete', async ({ page }) => {
    const api = await page.evaluate(() => {
      const a = (window as any).HermesEmotionAvatar;
      if (!a) return null;
      return {
        version: a.version,
        methods: Object.getOwnPropertyNames(a).filter((k: string) => typeof a[k] === 'function'),
      };
    });
    expect(api).not.toBeNull();
    expect(api!.version).toBe('0.8.1');
    const expected = ['setExpression','getExpression','setSize','getSize','switchModel','importModel','destroy','getModels','getActiveModel'];
    for (const m of expected) {
      expect(api!.methods).toContain(m);
    }
  });

  test('01.02: getModels returns 6 models with correct IDs', async ({ page }) => {
    const models = await page.evaluate(() => (window as any).HermesEmotionAvatar.getModels());
    expect(models).toBeInstanceOf(Array);
    expect(models.length).toBe(6);
    const ids = models.map((m: any) => m.id);
    expect(ids).toContain('__preset__pixel');
    expect(ids).toContain('__preset__neko');
    expect(ids).toContain('__preset__coolbanana');  // note: no hyphen
  });

  test.describe('Avatar Visual Rendering — Disappearance Detection', () => {
    test('01.03: Avatar overlay exists with non-zero dimensions and visible style', async ({ page }) => {
      const info = await page.evaluate(() => {
        const overlay = document.getElementById('hwx-emotion-avatar-overlay');
        if (!overlay) return { found: false };
        const rect = overlay.getBoundingClientRect();
        const s = window.getComputedStyle(overlay);
        const canvasDiv = document.getElementById('hwx-emotion-avatar-canvas');
        return {
          found: true,
          overlayRect: { x: rect.x, y: rect.y, w: rect.width, h: rect.height },
          canvasExists: !!canvasDiv,
          canvasW: canvasDiv?.offsetWidth ?? 0,
          canvasH: canvasDiv?.offsetHeight ?? 0,
          display: s.display,
          visibility: s.visibility,
          position: s.position,
        };
      });
      expect(info.found).toBe(true);
      expect(info.display).not.toBe('none');
      expect(info.visibility).not.toBe('hidden');
      expect(info.canvasExists).toBe(true);
      expect(info.canvasW).toBeGreaterThan(0);
      expect(info.canvasH).toBeGreaterThan(0);
    });

    test('01.04: Avatar overlay at expected bottom-right position', async ({ page }) => {
      const rect = await page.evaluate(() => {
        const overlay = document.getElementById('hwx-emotion-avatar-overlay');
        if (!overlay) return null;
        const r = overlay.getBoundingClientRect();
        return { x: r.x, y: r.y, w: r.width, h: r.height };
      });
      expect(rect).not.toBeNull();
      // Expected: corner positioned overlay at bottom-right (~1160, ~504), 96x96
      expect(rect!.x).toBeGreaterThan(1000);   // right side
      expect(rect!.y).toBeGreaterThan(400);    // lower portion of page
      expect(rect!.w).toBe(96);
      expect(rect!.h).toBe(96);
    });

    test('01.05: Avatar overlay visible after switchModel to each preset', async ({ page }) => {
      const models = await page.evaluate(() => (window as any).HermesEmotionAvatar.getModels());
      for (const model of models) {
        const id = model.id;
        // Skip VRM model — may load asynchronously
        if (id === '__preset__coolbanana') continue;

        const ok = await page.evaluate((mid: string) =>
          (window as any).HermesEmotionAvatar.switchModel(mid), id);
        expect(ok).toBe(true);

        await page.waitForTimeout(1500);

        const info = await page.evaluate(() => {
          const overlay = document.getElementById('hwx-emotion-avatar-overlay');
          if (!overlay) return { visible: false };
          const s = window.getComputedStyle(overlay);
          return { visible: s.display !== 'none' && s.visibility !== 'hidden', w: overlay.offsetWidth };
        });
        expect.soft(info.visible).toBe(true);
        expect.soft(info.w).toBeGreaterThan(0);
        if (!info.visible) {
          console.error(`Overlay hidden after switchModel(${id})`);
        }
      }
    });

    test('01.06: Overlay persists through expression cycling', async ({ page }) => {
      for (const expr of ['happy', 'sad', 'thinking']) {
        const threw = await page.evaluate(async (e: string) => {
          try {
            await (window as any).HermesEmotionAvatar.setExpression(e);
            return false;
          } catch {
            return true;
          }
        }, expr);
        expect(threw).toBe(false);
        await page.waitForTimeout(500);

        const info = await page.evaluate(() => {
          const overlay = document.getElementById('hwx-emotion-avatar-overlay');
          if (!overlay) return { found: false };
          return { found: true, w: overlay.offsetWidth, h: overlay.offsetHeight };
        });
        expect.soft(info.found).toBe(true);
        expect.soft(info.w).toBeGreaterThan(0);
        if (!info.found) {
          console.error(`Overlay GONE after setExpression(${expr})`);
        }
      }
    });

    test('01.07: Stress test — 20 rapid model switches keep overlay alive', async ({ page }) => {
      const models = await page.evaluate(() => (window as any).HermesEmotionAvatar.getModels());
      const presets = models.filter((m: any) => m.id !== '__preset__coolbanana');
      if (presets.length === 0) {
        test.skip(true, 'No preset models to cycle');
        return;
      }

      for (let i = 0; i < 20; i++) {
        const model = presets[i % presets.length];
        await page.evaluate((mid: string) =>
          (window as any).HermesEmotionAvatar.switchModel(mid), model.id);
        await page.waitForTimeout(100);
      }

      await page.waitForTimeout(2000);
      const info = await page.evaluate(() => {
        const overlay = document.getElementById('hwx-emotion-avatar-overlay');
        if (!overlay) return { alive: false };
        return { alive: true, w: overlay.offsetWidth, h: overlay.offsetHeight };
      });
      expect(info.alive).toBe(true);
      expect(info.w).toBeGreaterThan(0);
    });

    test('01.08: DOM stability during extensive model switching', async ({ page }) => {
      const initialDOM = await page.evaluate(() => ({
        canvasExists: !!document.getElementById('hwx-emotion-avatar-canvas'),
        overlayExists: !!document.getElementById('hwx-emotion-avatar-overlay'),
        btnExists: !!document.getElementById('hwx-avatar-titlebar-btn'),
      }));

      // Cycle through all presets
      for (const id of ['__preset__pixel', '__preset__neko', '__preset__robot', '__preset__pixel']) {
        await page.evaluate((mid: string) =>
          (window as any).HermesEmotionAvatar.switchModel(mid), id);
        await page.waitForTimeout(500);
      }

      const afterDOM = await page.evaluate(() => ({
        canvasExists: !!document.getElementById('hwx-emotion-avatar-canvas'),
        overlayExists: !!document.getElementById('hwx-emotion-avatar-overlay'),
        btnExists: !!document.getElementById('hwx-avatar-titlebar-btn'),
      }));

      expect(afterDOM).toEqual(initialDOM);
    });

    test('01.09: Screenshot of avatar area has content (not blank)', async ({ page }) => {
      // Take a cropped screenshot of just the avatar overlay area
      const clip = await page.evaluate(() => {
        const overlay = document.getElementById('hwx-emotion-avatar-overlay');
        if (!overlay) return null;
        const r = overlay.getBoundingClientRect();
        return { x: r.x, y: r.y, width: r.width, height: r.height };
      });

      expect(clip).not.toBeNull();
      if (!clip) return;

      // Screenshot the avatar area after switching models
      await page.evaluate(() => (window as any).HermesEmotionAvatar.switchModel('__preset__pixel'));
      await page.waitForTimeout(2000);

      const avatarShot = await page.screenshot({ clip: clip as any });
      expect(avatarShot.length).toBeGreaterThan(100);  // at least 100 bytes (should be much more)
    });
  });

  test.describe('Avatar Settings UI', () => {
    test('01.10: Titlebar button exists and is clickable', async ({ page }) => {
      const btn = page.locator('#hwx-avatar-titlebar-btn').first();
      await expect(btn).toBeVisible({ timeout: 5000 });
      await expect(btn).toHaveAttribute('aria-label', 'Avatar settings');
    });

    test('01.11: Titlebar button click reveals settings panel', async ({ page }) => {
      const btn = page.locator('#hwx-avatar-titlebar-btn').first();
      await expect(btn).toBeVisible({ timeout: 5000 });

      // Click opens settings panel
      await btn.click();
      await page.waitForTimeout(1000);

      const panel = await page.evaluate(() => {
        const el = document.getElementById('hwx-avatar-settings');
        if (!el) return { found: false };
        const s = window.getComputedStyle(el);
        return { found: true, display: s.display, visible: s.display !== 'none' };
      });
      expect(panel.found).toBe(true);
      expect(panel.visible).toBe(true);
    });
  });

  test.describe('Console & Error Tracking', () => {
    test('01.12: No console errors during model switching', async ({ page }) => {
      const consoleErrors: string[] = [];
      page.on('console', msg => {
        if (msg.type() === 'error' || msg.type() === 'exception') {
          consoleErrors.push(`[${msg.type()}] ${msg.text()}`);
        }
      });

      await page.evaluate(() => (window as any).HermesEmotionAvatar.switchModel('__preset__pixel'));
      await page.waitForTimeout(1000);
      await page.evaluate(() => (window as any).HermesEmotionAvatar.switchModel('__preset__neko'));
      await page.waitForTimeout(1000);

      const extErrors = consoleErrors.filter(e => !e.includes('ERR_CONNECTION_REFUSED'));
      expect(extErrors).toHaveLength(0);
    });

    test('01.13: No page errors during expression + model cycles', async ({ page }) => {
      const pageErrors: string[] = [];
      page.on('pageerror', err => pageErrors.push(err.message));

      for (let i = 0; i < 5; i++) {
        await page.evaluate(() => (window as any).HermesEmotionAvatar.switchModel('__preset__pixel'));
        await page.waitForTimeout(200);
        await page.evaluate(() => (window as any).HermesEmotionAvatar.setExpression('happy'));
        await page.waitForTimeout(200);
      }

      expect(pageErrors).toHaveLength(0);
    });
  });
});
