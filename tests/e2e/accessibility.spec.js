import AxeBuilder from '@axe-core/playwright';
import { test, expect } from './fixtures.js';

const scan = async page => {
  const { violations } = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa']).analyze();
  return violations.map(v => `${v.id} (${v.impact}): ${v.nodes.map(n => n.target.join(' ')).slice(0, 3).join(', ')}`);
};

for (const theme of ['light', 'dark']) {
  test.describe(`${theme} theme`, () => {
    test.beforeEach(async ({ page }) => {
      await page.addInitScript(t => localStorage.setItem('bd-discovery-passport:theme', t), theme);
    });

    test('atlas at rest', async ({ page }) => {
      await page.goto('/');
      expect(await scan(page)).toEqual([]);
    });

    test('passport page open (verified content)', async ({ page }) => {
      await page.goto('/?district=54');
      await expect(page.getByRole('dialog', { name: 'Sylhet' })).toBeVisible();
      await page.waitForTimeout(600); // let the stamp and sheet settle
      expect(await scan(page)).toEqual([]);
    });

    test('menu and sign-up dialog', async ({ page }) => {
      await page.goto('/');
      await page.getByRole('button', { name: 'Menu' }).click();
      expect(await scan(page)).toEqual([]);
      await page.getByRole('button', { name: 'Create account' }).click();
      await page.waitForTimeout(300);
      expect(await scan(page)).toEqual([]);
    });

    test('privacy notice', async ({ page }) => {
      await page.goto('/privacy/');
      expect(await scan(page)).toEqual([]);
    });
  });
}
