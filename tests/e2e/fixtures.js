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

/**
 * Pixels between the top of a place row's `·` separator and the first line of the address after it: 0 when they share
 * a line, about a line height when the separator dangles at the end of the line above.
 */
export const separatorLineGap = row =>
  row.locator('p:has(> .kind)').evaluate(meta => {
    const dot = [...meta.querySelectorAll('[aria-hidden="true"]')].find(el => el.textContent === '·');
    const walker = document.createTreeWalker(meta, NodeFilter.SHOW_TEXT);
    let address = null;
    for (let node = walker.nextNode(); node && !address; node = walker.nextNode()) {
      const after = dot.compareDocumentPosition(node) & Node.DOCUMENT_POSITION_FOLLOWING;
      if (after && !dot.contains(node) && node.textContent.trim()) address = node;
    }
    const range = document.createRange();
    range.selectNodeContents(address);
    return Math.abs(range.getClientRects()[0].top - dot.getBoundingClientRect().top);
  });
