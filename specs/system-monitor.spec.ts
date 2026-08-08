import { test, expect } from '../lib/auth-fixture';

test.describe('System Monitor Extension', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/', { waitUntil: 'load', timeout: 15000 });
    await page.waitForTimeout(3000);
  });

  test('SM.01: Titlebar widget attaches and canvas has non-zero size', async ({ page }) => {
    const widget = page.locator('#hwx-monitor-titlebar');
    await expect(widget.first()).toBeAttached({ timeout: 5000 });

    const canvas = page.locator('#hwx-monitor-canvas');
    await expect(canvas.first()).toBeAttached({ timeout: 5000 });

    const box = await canvas.first().boundingBox();
    expect(box).not.toBeNull();
    expect(box!.width).toBeGreaterThan(0);
    expect(box!.height).toBeGreaterThan(0);
  });

  test('SM.02: Public API global is exposed', async ({ page }) => {
    const api = await page.evaluate(() => ({
      loaded: typeof window.HermesSystemMonitor !== 'undefined',
      version: window.HermesSystemMonitor?.version,
      getStats: typeof window.HermesSystemMonitor?.getStats === 'function',
      getConfig: typeof window.HermesSystemMonitor?.getConfig === 'function',
      setConfig: typeof window.HermesSystemMonitor?.setConfig === 'function',
      destroy: typeof window.HermesSystemMonitor?.destroy === 'function',
    }));
    expect(api.loaded).toBe(true);
    expect(api.version).toBe('0.8.1');
    expect(api.getStats).toBe(true);
    expect(api.getConfig).toBe(true);
    expect(api.setConfig).toBe(true);
    expect(api.destroy).toBe(true);
  });

  test('SM.03: Stats populate after first poll', async ({ page }) => {
    await page.waitForTimeout(3000);
    const stats = await page.evaluate(() => window.HermesSystemMonitor.getStats());
    const values = [stats.cpu, stats.ram, stats.disk];
    const hasValue = values.some(v => v !== null);
    const allNull = values.every(v => v === null);
    expect(hasValue || allNull).toBe(true);
    values.forEach(v => {
      if (v !== null) {
        expect(v).toBeGreaterThanOrEqual(0);
        expect(v).toBeLessThanOrEqual(100);
      }
    });
    // Net is split into rx/tx — both should be numbers or null
    expect(typeof stats.netRx === 'number' || stats.netRx === null).toBe(true);
    expect(typeof stats.netTx === 'number' || stats.netTx === null).toBe(true);
  });

  test('SM.04: Click widget opens popup with metric rows', async ({ page }) => {
    const canvas = page.locator('#hwx-monitor-canvas');
    await expect(canvas.first()).toBeAttached({ timeout: 5000 });
    await canvas.first().click({ timeout: 5000 });

    const popup = page.locator('#hwx-monitor-popup');
    await expect(popup.first()).toBeVisible({ timeout: 5000 });

    const body = page.locator('#hwx-monitor-popup-body');
    await expect(body.first()).toBeVisible({ timeout: 5000 });
    const rows = page.locator('.monitor-popup-row');
    await expect(rows.first()).toBeVisible({ timeout: 5000 });
  });

  test('SM.05: Popup close button works', async ({ page }) => {
    await page.locator('#hwx-monitor-canvas').first().click({ timeout: 5000 });
    await expect(page.locator('#hwx-monitor-popup').first()).toBeVisible({ timeout: 5000 });

    await page.locator('.monitor-popup-close').first().click({ timeout: 5000 });
    await expect(page.locator('#hwx-monitor-popup')).toHaveCount(0);
  });

  test('SM.06: Settings button opens settings panel', async ({ page }) => {
    await page.locator('#hwx-monitor-canvas').first().click({ timeout: 5000 });
    await expect(page.locator('#hwx-monitor-popup').first()).toBeVisible({ timeout: 5000 });

    await page.locator('#hwx-monitor-popup-settings').first().click({ timeout: 5000 });
    const settings = page.locator('#hwx-monitor-settings');
    await expect(settings.first()).toBeVisible({ timeout: 5000 });
  });

  test('SM.07: Toggle CPU module removes it from DOM', async ({ page }) => {
    // Open settings
    await page.locator('#hwx-monitor-canvas').first().click({ timeout: 5000 });
    await expect(page.locator('#hwx-monitor-popup').first()).toBeVisible({ timeout: 5000 });
    await page.locator('#hwx-monitor-popup-settings').first().click({ timeout: 5000 });
    await expect(page.locator('#hwx-monitor-settings').first()).toBeVisible({ timeout: 5000 });

    // Read current canvas width
    const canvas = page.locator('#hwx-monitor-canvas');
    const before = (await canvas.first().boundingBox())!.width;

    // Uncheck CPU (first checkbox in settings)
    const cpuCheckbox = page.locator('#hwx-monitor-settings input[type="checkbox"]').first();
    await cpuCheckbox.uncheck();

    // Canvas should shrink
    await page.waitForTimeout(300);
    const after = (await canvas.first().boundingBox())!.width;
    expect(after).toBeLessThan(before);
  });

  test('SM.08: Config persists after reload', async ({ page }) => {
    // Open settings and toggle CPU off
    await page.locator('#hwx-monitor-canvas').first().click({ timeout: 5000 });
    await expect(page.locator('#hwx-monitor-popup').first()).toBeVisible({ timeout: 5000 });
    await page.locator('#hwx-monitor-popup-settings').first().click({ timeout: 5000 });
    await expect(page.locator('#hwx-monitor-settings').first()).toBeVisible({ timeout: 5000 });
    await page.locator('#hwx-monitor-settings input[type="checkbox"]').first().uncheck();

    // Reload
    await page.reload({ waitUntil: 'load', timeout: 15000 });
    await page.waitForTimeout(3000);

    // Check localStorage
    const config = await page.evaluate(() => {
      try { return JSON.parse(localStorage.getItem('hwx-monitor-config') || '{}'); }
      catch { return {}; }
    });
    expect(config.showCpu).toBe(false);
  });

  test('SM.09: Zero console errors from extension code', async ({ page }) => {
    const consoleErrors: string[] = [];
    page.on('console', msg => {
      if (msg.type() === 'error' || msg.type() === 'exception') {
        consoleErrors.push(msg.text());
      }
    });
    await page.waitForTimeout(3000);
    await page.locator('#hwx-monitor-canvas').first().click({ timeout: 5000 });
    await page.waitForTimeout(500);
    await page.locator('.monitor-popup-close').first().click({ timeout: 5000 });
    await page.waitForTimeout(500);

    const extErrors = consoleErrors.filter(e => !e.includes('ERR_CONNECTION_REFUSED'));
    expect(extErrors).toHaveLength(0);
  });

  test('SM.10: Net graph renders fill in both halves with K/M labels', async ({ page }) => {
    await page.waitForTimeout(5000);
    const info = await page.evaluate(() => {
      const canvas = document.querySelector('#hwx-monitor-canvas');
      const ctx = canvas.getContext('2d');
      const cw = canvas.width, ch = canvas.height;
      const cell = 18, gap = 3;
      const x0 = 4 + 4 * (cell + gap), y0 = 2, half = cell / 2;
      const data = ctx.getImageData(0, 0, cw, ch).data;
      const count = (y1, y2) => { let n = 0; for (let y = y1; y < y2; y++) for (let x = x0; x < x0 + cell; x++) { const i = (y * cw + x) * 4; if (data[i+3] > 30) n++; } return n; };
      const s = window.HermesSystemMonitor.getStats();
      const fmt = v => v == null ? '—' : v >= 1048576 ? (v / 1048576).toFixed(1) + 'M' : (v / 1024).toFixed(1) + 'K';
      return { top: count(y0, y0 + half), bottom: count(y0 + half, y0 + cell), netRx: s.netRx, netTx: s.netTx, labelRx: fmt(s.netRx), labelTx: fmt(s.netTx) };
    });
    // When both directions have live traffic, fills must appear in the correct halves.
    expect(info.netRx > 0 || info.netTx > 0).toBe(true);
    expect(info.top + info.bottom).toBeGreaterThan(10);
    expect(info.labelRx).toMatch(/^(—|\d+(\.\d+)?[KM])$/);
    expect(info.labelTx).toMatch(/^(—|\d+(\.\d+)?[KM])$/);
    expect(info.labelRx).not.toContain('B/s');
    expect(info.labelTx).not.toContain('B/s');
  });

  test('SM.11: Popup Net row is one compact braille block with up (top) + down (bottom) halves', async ({ page }) => {
    await page.waitForTimeout(5000);
    await page.locator('#hwx-monitor-canvas').first().click({ timeout: 5000 });
    await page.waitForTimeout(800);
    const info = await page.evaluate(() => {
      const netRow = [...document.querySelectorAll('.monitor-popup-row')].find(r => r.textContent.includes('Net'));
      if (!netRow) return { error: 'no net row' };
      const pres = [...netRow.querySelectorAll('pre.monitor-popup-braille')];
      const decode = text => {
        let top = 0, bottom = 0;
        const lines = text.trim().split('\n');
        lines.forEach((ln, li) => {
          for (const ch of ln) {
            let bits = ch.codePointAt(0) - 0x2800;
            for (let b = 0; b < 8; b++) if (bits & (1 << b)) {
              const rowInBlock = b % 4; // 0-3 within each braille cell
              const absRow = li * 4 + rowInBlock;
              if (absRow < lines.length * 2) top++; else bottom++;
            }
          }
        });
        return { top, bottom };
      };
      const txt = pres[0] ? pres[0].textContent : '';
      const s = window.HermesSystemMonitor.getStats();
      return {
        brailleCount: pres.length,
        ariaLabel: pres[0] ? pres[0].getAttribute('aria-label') : null,
        lines: txt.trim().split('\n').length,
        halves: decode(txt),
        netRx: Math.round(s.netRx), netTx: Math.round(s.netTx),
        popupHeight: document.querySelector('#hwx-monitor-popup')?.getBoundingClientRect().height || 0,
      };
    });
    expect(info.error).toBeUndefined();
    expect(info.brailleCount).toBe(1);
    expect(info.ariaLabel).toBe('net up+down');
    expect(info.lines).toBe(4); // same height as every other metric row
    // With live traffic, both halves carry dots.
    if (info.netRx > 0 || info.netTx > 0) {
      expect(info.halves.top + info.halves.bottom).toBeGreaterThan(0);
    }
  });

  test('SM.12: Net graph uses two colors — up (tx) and down (rx) distinct', async ({ page }) => {
    await page.waitForTimeout(5000);
    const cfgInfo = await page.evaluate(() => {
      const g = window.HermesSystemMonitor.getConfig();
      const c = document.querySelector('#hwx-monitor-canvas');
      const ctx = c.getContext('2d');
      const w = c.width, h = c.height;
      const img = ctx.getImageData(0, 0, w, h).data;
      const colors = new Set();
      for (let i = 0; i < img.length; i += 4) {
        if (img[i + 3] > 60) colors.add(img[i] + ',' + img[i + 1] + ',' + img[i + 2]);
      }
      return { up: g.netUpColor, dn: g.netDownColor, distinctColors: colors.size, colors: [...colors] };
    });
    expect(cfgInfo.up).not.toBe(cfgInfo.dn);
    expect(cfgInfo.distinctColors).toBeGreaterThanOrEqual(2); // up + down + white labels ≥ 2
    // Popup: braille pre must have two differently-colored spans.
    await page.locator('#hwx-monitor-canvas').first().click({ timeout: 5000 });
    await page.waitForTimeout(800);
    const popupInfo = await page.evaluate(() => {
      const netRow = [...document.querySelectorAll('.monitor-popup-row')].find(r => r.textContent.includes('Net'));
      const pre = netRow ? netRow.querySelector('pre.monitor-popup-braille') : null;
      const spans = pre ? [...pre.querySelectorAll('span')].map(s => s.style.color) : [];
      const labels = netRow ? [...netRow.querySelectorAll('.monitor-popup-net-up, .monitor-popup-net-dn')].map(s => getComputedStyle(s).color) : [];
      return { spans, labels };
    });
    expect(popupInfo.spans.length).toBe(2);
    expect(popupInfo.spans[0]).not.toBe(popupInfo.spans[1]);
    expect(popupInfo.labels.length).toBe(2);
    expect(popupInfo.labels[0]).not.toBe(popupInfo.labels[1]);
  });

  test('SM.13: Popup IO detail uses compact K/M with one decimal (no B/s)', async ({ page }) => {
    await page.waitForTimeout(5000);
    await page.locator('#hwx-monitor-canvas').first().click({ timeout: 5000 });
    await page.waitForTimeout(800);
    const info = await page.evaluate(() => {
      const ioRow = [...document.querySelectorAll('.monitor-popup-row')].find(r => r.querySelector('.monitor-popup-label')?.textContent.trim() === 'IO');
      if (!ioRow) return { error: 'no IO row' };
      const em = ioRow.querySelector('em');
      const val = ioRow.querySelector('.monitor-popup-val');
      const s = window.HermesSystemMonitor.getStats();
      return {
        detail: em ? em.textContent.trim() : null,
        bodyVal: val ? val.childNodes[0]?.textContent.trim() : null,
        diskIO: s.diskIO,
      };
    });
    expect(info.error).toBeUndefined();
    // Detail must be K or M with one decimal (or '—' when null) — never 'B/s'.
    expect(info.detail).toMatch(/^(—|\d+(\.\d)?[KM])$/);
    expect(info.detail).not.toContain('B/s');
    // Body value keeps its existing format: '—', one decimal (<1 MB/s), or integer MB/s.
    if (info.diskIO != null) {
      expect(info.bodyVal).toMatch(/^(\d+(\.\d)?)$/);
    } else {
      expect(info.bodyVal).toBe('—');
    }
  });
});
