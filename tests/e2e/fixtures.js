import { test as base, expect } from '@playwright/test';

/**
 * Every test gets a page that records CSP violations, uncaught errors and console errors.
 * The test fails afterwards if any happened, so the CSP is exercised by the whole suite.
 */
export const test = base.extend({
  page: async ({ page }, use) => {
    const problems = [];
    await page.addInitScript(() => {
      document.addEventListener('securitypolicyviolation', e => {
        window.__cspViolations = window.__cspViolations || [];
        window.__cspViolations.push(`${e.violatedDirective} blocked ${e.blockedURI || 'inline'}`);
      });
    });
    page.on('pageerror', e => problems.push(`pageerror: ${e.message}`));
    page.on('console', m => {
      // A 401 from a deliberate wrong-password attempt is expected, not a bug.
      if (m.type() === 'error' && !/status of 401/.test(m.text())) problems.push(`console: ${m.text()}`);
    });
    await use(page);
    const csp = await page.evaluate(() => window.__cspViolations ?? []).catch(() => []);
    expect([...problems, ...csp.map(v => `csp: ${v}`)], 'no errors or CSP violations').toEqual([]);
  },
});

export { expect };

export const countText = async page => (await page.getByRole('banner').innerText()).match(/(\d+)\s*\/\s*64/)?.[1];
