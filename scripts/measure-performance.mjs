#!/usr/bin/env node
/**
 * Lab performance measurement against a running server (default http://127.0.0.1:8788).
 * Profiles: desktop (no throttling) and a mid-range phone (Slow 4G + 4x CPU slowdown via CDP).
 * Reports LCP (+ element), CLS, FCP, total transferred bytes by type. Usage: node scripts/measure-performance.mjs [url]
 */
import { chromium } from 'playwright';

const URL_ = process.argv[2] || 'http://127.0.0.1:8788/';
const PROFILES = {
  desktop: { viewport: { width: 1440, height: 900 }, throttle: null },
  'phone-slow-4g': {
    viewport: { width: 412, height: 915 },
    // Lighthouse "Slow 4G": 150 ms RTT, ~1.6 Mbps down, 750 kbps up, 4x CPU
    throttle: { latency: 150, downloadThroughput: (1.6 * 1024 * 1024) / 8, uploadThroughput: (750 * 1024) / 8, cpu: 4 },
  },
};

const browser = await chromium.launch();
for (const [name, profile] of Object.entries(PROFILES)) {
  const ctx = await browser.newContext({ viewport: profile.viewport });
  const page = await ctx.newPage();
  const cdp = await ctx.newCDPSession(page);
  await cdp.send('Network.enable');
  await cdp.send('Network.setCacheDisabled', { cacheDisabled: true });
  if (profile.throttle) {
    const { cpu, ...net } = profile.throttle;
    await cdp.send('Network.emulateNetworkConditions', { offline: false, ...net });
    await cdp.send('Emulation.setCPUThrottlingRate', { rate: cpu });
  }
  const bytes = {};
  cdp.on('Network.loadingFinished', e => (bytes[e.requestId] = { ...(bytes[e.requestId] || {}), size: e.encodedDataLength }));
  cdp.on('Network.responseReceived', e => (bytes[e.requestId] = { ...(bytes[e.requestId] || {}), type: e.type, url: e.response.url }));

  await page.addInitScript(() => {
    window.__perf = { lcp: 0, lcpEl: '', cls: 0 };
    new PerformanceObserver(list => {
      for (const e of list.getEntries()) {
        window.__perf.lcp = e.startTime;
        window.__perf.lcpEl = e.element ? `${e.element.tagName.toLowerCase()}${e.element.id ? '#' + e.element.id : ''}.${[...(e.element.classList || [])].slice(0, 2).join('.')}` : '(none)';
      }
    }).observe({ type: 'largest-contentful-paint', buffered: true });
    new PerformanceObserver(list => {
      for (const e of list.getEntries()) if (!e.hadRecentInput) window.__perf.cls += e.value;
    }).observe({ type: 'layout-shift', buffered: true });
  });

  await page.goto(URL_, { waitUntil: 'networkidle' });
  await page.waitForTimeout(1500);
  const perf = await page.evaluate(() => ({ ...window.__perf, fcp: performance.getEntriesByName('first-contentful-paint')[0]?.startTime ?? 0 }));
  const totals = {};
  for (const r of Object.values(bytes)) if (r.size) totals[r.type] = (totals[r.type] || 0) + r.size;
  const kb = n => `${(n / 1024).toFixed(1)} KB`;
  console.log(`\n${name}`);
  console.log(`  FCP ${perf.fcp.toFixed(0)} ms | LCP ${perf.lcp.toFixed(0)} ms (${perf.lcpEl}) | CLS ${perf.cls.toFixed(3)}`);
  console.log(`  transferred: ${Object.entries(totals).map(([t, n]) => `${t} ${kb(n)}`).join(', ')} | total ${kb(Object.values(totals).reduce((a, b) => a + b, 0))}`);
  await ctx.close();
}
await browser.close();
