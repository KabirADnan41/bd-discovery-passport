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

// The longest Bengali kind (Meherpur) and the longest Bengali note (Sylhet) must wrap inside a phone screen.
for (const [district, place, kindBn] of [
  ['Meherpur', 'Bhatpara Nilkuthi', 'নীলকুঠির ধ্বংসাবশেষ ও উদ্যান'],
  ['Sylhet', 'Bichanakandi', 'নদীতে নৌকা ভ্রমণ'],
]) {
  test(`phone: ${place}'s Bengali kind and note wrap without sideways scrolling`, async ({ page, isMobile }) => {
    test.skip(!isMobile, 'phone layout');
    await page.goto('/');
    await page.evaluate(() => document.fonts.ready);
    await page.locator('#district-index').getByRole('button', { name: new RegExp(`^${district}`) }).click();
    const row = page.getByRole('dialog', { name: district }).getByRole('listitem').filter({ hasText: place });
    const label = row.locator('.kind + [lang="bn"]');
    await label.scrollIntoViewIfNeeded();
    await expect(label).toHaveText(kindBn);
    const width = page.viewportSize().width;
    for (const el of [label, row.locator('p[lang="bn"]')]) expect((await el.boundingBox()).x + (await el.boundingBox()).width).toBeLessThanOrEqual(width);
    expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(0);
  });
}

// A long trip runs the planner far below the screen. On desktop widths the map beside it stays in view (the sheet is sticky and
// always fits the screen), the page keeps its one scroll (no scroll box inside the planner) and nothing covers the planner.
const LONG_TRIP = {
  name: '',
  days: [['54-bichanakandi', '54-lalakhal', '54-keane-bridge', '54-shah-paran-dargah'], ['43-patenga-sea-beach', '45-inani-beach'], ['1-star-mosque']].map(
    day => day.map(id => ({ kind: 'place', id })),
  ),
};
for (const [width, height] of [
  [1024, 768],
  [1440, 900],
]) {
  test(`at ${width}px the map stays in view beside a long planner, with no scroll box of its own`, async ({ page, isMobile }) => {
    test.skip(isMobile, 'desktop layout; phones keep the planner above the map');
    await page.setViewportSize({ width, height });
    await page.addInitScript(t => localStorage.setItem('bd-discovery-passport:trip:v1', t), JSON.stringify(LONG_TRIP));
    await page.goto('/');
    await page.getByRole('tab', { name: /^Plan/ }).click();
    await expect(page.getByRole('heading', { name: /^Your trip/ })).toBeVisible();
    const masthead = await rect(page.getByRole('banner'));
    expect((await rect(page.locator('.atlas-sheet'))).top).toBeGreaterThanOrEqual(masthead.bottom); // under the masthead at the top

    // scroll as a reader does, until the planner's last controls sit at the bottom of the screen (the furthest point still in
    // the planner; scrolling on past the atlas section rightly takes the map up with it)
    const share = page.getByRole('button', { name: 'Share trip' });
    await share.evaluate(el => window.scrollBy(0, el.getBoundingClientRect().bottom - window.innerHeight + 24));
    expect(await page.evaluate(() => window.scrollY)).toBeGreaterThan(200); // the page scrolled, not a box inside it
    expect((await rect(page.locator('.atlas-sheet'))).top).toBeGreaterThanOrEqual(0);
    for (const part of ['.map-canvas', '.atlas-key']) {
      const box = await rect(page.locator(part));
      expect(box.top, part).toBeGreaterThanOrEqual(0);
      expect(box.bottom, part).toBeLessThanOrEqual(height); // the whole map and its key stay on screen
    }
    const own = await page.getByRole('heading', { name: /^Your trip/ }).evaluate(h => {
      for (let el = h.parentElement; el && el !== document.body; el = el.parentElement)
        if (el.scrollHeight > el.clientHeight + 1 && /auto|scroll/.test(getComputedStyle(el).overflowY)) return el.className;
      return null;
    });
    expect(own).toBeNull();
    const onTop = await share.evaluate(el => {
      const r = el.getBoundingClientRect();
      return el.contains(document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2));
    });
    expect(onTop).toBe(true); // the sticky map never covers the planner's controls
  });
}
