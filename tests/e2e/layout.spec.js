import { test, expect } from './fixtures.js';

// The atlas layout's guardrails. On a desktop the journal rests on the atlas sheet's edge but never on the map, so no district
// is covered and the map keeps every click up to its right edge. On a phone nothing scrolls sideways.
const rect = locator => locator.evaluate(el => el.getBoundingClientRect().toJSON());
const intersects = (a, b) => a.left < b.right && b.left < a.right && a.top < b.bottom && b.top < a.bottom;

// each state's journal: the passport's own page, a district's page, the quiz prompt, the planner
const DESKTOP_STATES = [
  ['Explore', async page => expect(page.getByRole('heading', { name: 'Explore Bangladesh, one district at a time.' })).toBeVisible()],
  [
    'a district open',
    async page => {
      await page.locator('[data-district-id="54"]').click();
      await expect(page.getByRole('dialog', { name: 'Sylhet' })).toBeVisible();
    },
  ],
  [
    'Quiz',
    async page => {
      await page.getByRole('tab', { name: /^Quiz/ }).click();
      await expect(page.locator('.quiz-progress')).toBeVisible();
    },
  ],
  [
    'Plan',
    async page => {
      await page.getByRole('tab', { name: /^Plan/ }).click();
      await expect(page.getByRole('heading', { name: /^Your trip/ })).toBeVisible();
    },
  ],
];

for (const [state, enter] of DESKTOP_STATES) {
  test(`desktop, ${state}: the journal overlaps the atlas sheet but never the map`, async ({ page, isMobile }) => {
    test.skip(isMobile, 'the overlap is a wide-screen layout');
    await page.goto('/');
    await enter(page);
    await expect(page.locator('.journal:visible')).toHaveCount(1);
    await page.evaluate(() => document.fonts.ready);

    const canvas = await rect(page.locator('.map-canvas'));
    const sheet = await rect(page.locator('#map-section'));
    const journal = await rect(page.locator('.journal:visible'));
    expect(journal.left, 'the journal rests on the sheet').toBeLessThan(sheet.right);
    expect(intersects(journal, canvas), 'the journal stays off the map').toBe(false);

    // just inside the map's right edge, halfway down, the pointer still reaches the map
    const atEdge = { x: canvas.right - 2, y: canvas.top + canvas.height / 2 };
    expect(await page.evaluate(({ x, y }) => Boolean(document.elementFromPoint(x, y)?.closest('.map-canvas')), atEdge)).toBe(true);
  });
}

test('phone: no sideways scrolling on Explore or with a district open', async ({ page, isMobile }) => {
  test.skip(!isMobile, 'phone layout');
  const overflow = () => page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  await page.goto('/');
  await page.evaluate(() => document.fonts.ready);
  expect(await overflow(), 'Explore').toBeLessThanOrEqual(0);

  await page.locator('[data-district-id="54"]').click();
  await expect(page.getByRole('dialog', { name: 'Sylhet' })).toBeVisible();
  expect(await overflow(), 'a district open').toBeLessThanOrEqual(0);
});
