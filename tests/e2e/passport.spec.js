import { test, expect, countText } from './fixtures.js';

// The passport page: its title lockup, its place rows, the first-discovery sequence (stamp, ink on the map, the count) and the
// rule that only the first open enters. These check states and behaviour, never timings.

const district = (page, id) => page.locator(`[data-district-id="${id}"]`);
const card = (page, name) => page.getByRole('dialog', { name });
const atRest = page => page.waitForFunction(() => document.getAnimations().every(a => a.playState !== 'running'));
// the CSS animations (not transitions) running or waiting on an element and what is inside it
const cssAnimations = locator =>
  locator.evaluate(el =>
    el
      .getAnimations({ subtree: true })
      .filter(a => a instanceof CSSAnimation)
      .map(a => a.animationName),
  );
const SEEDED = { discovered: ['54', '53'] }; // Sylhet and its neighbour Sunamganj

test('the title is one lockup: the Bengali name sits directly under the English, in the same ink', async ({ page }) => {
  await page.goto('/?district=54');
  const title = page.locator('#passport-title');
  await expect(title).toHaveText('Sylhet');
  const bn = title.locator('xpath=following-sibling::p[@lang="bn"]');
  await expect(bn).toHaveText('সিলেট');
  const [en, under] = [await title.boundingBox(), await bn.boundingBox()];
  expect(under.y - (en.y + en.height), 'the Bengali name is right under the English one').toBeLessThan(16);
  const ink = locator => locator.evaluate(el => getComputedStyle(el).color);
  expect(await ink(bn)).toBe(await ink(title));
});

test('place actions keep their names and targets, and "In your trip" stays focused after the press', async ({ page }) => {
  await page.goto('/?district=54');
  const places = card(page, 'Sylhet').locator('section', { has: page.getByRole('heading', { name: /^Places to go/ }) });
  const add = places.getByRole('button', { name: 'Add to trip: Bichanakandi', exact: true });
  await expect(add).toBeVisible();
  await atRest(page); // a translated box can measure a float rounding under its height
  const directions = places.getByRole('link', { name: 'Directions to Bichanakandi in Google Maps (opens in a new tab)', exact: true });
  await expect(directions).toHaveAttribute('target', '_blank');
  await expect(directions).toHaveAttribute('rel', /noopener/);
  expect((await directions.boundingBox()).height).toBeGreaterThanOrEqual(44);
  expect((await add.boundingBox()).height).toBeGreaterThanOrEqual(44);

  await add.click();
  const inTrip = places.getByRole('button', { name: 'In your trip: Bichanakandi', exact: true });
  await expect(inTrip).toHaveAttribute('aria-disabled', 'true');
  await expect(inTrip).toBeFocused();
  await expect(page.getByRole('status')).toHaveText('Added Bichanakandi to your trip.');
});

test('a first discovery: the count is true at once, then the stamp lands, the district inks in and everything comes to rest', async ({ page }) => {
  await page.goto('/');
  await district(page, '54').click();
  await expect(card(page, 'Sylhet')).toBeVisible();
  // the text never waits for the picture: the count, the stamp's label and the district's state are there at once
  expect(await countText(page)).toBe('1');
  await expect(district(page, '54')).toHaveAttribute('data-state', 'discovered');
  await expect(card(page, 'Sylhet').getByText('New stamp')).toBeVisible();
  await expect(page.locator('.overlay-selection')).toHaveAttribute('data-inking');
  await expect(page.locator('.overlay-selected-ink')).toHaveCount(1);
  expect(await page.getByRole('status').textContent()).toBe('Discovered Sylhet. 1 of 64 districts discovered.');

  await atRest(page); // nothing keeps running: no idle motion
  expect(await countText(page)).toBe('1');
  await expect(page.locator('header .count[data-prev]')).toHaveCount(0); // the tick has played
  const inked = await page.locator('.overlay-selected-ink').evaluate(el => getComputedStyle(el).clipPath);
  expect(inked, 'the ink has spread over the whole district').toBe('none');
  expect(Number(await page.locator('svg.stamp-impact').evaluate(el => getComputedStyle(el).opacity))).toBeGreaterThan(0.5);
});

test('reopening a stamped district plays no sequence, and says so', async ({ page }) => {
  await page.addInitScript(seed => localStorage.setItem('bd-discovery-passport:v1', JSON.stringify(seed)), SEEDED);
  await page.goto('/');
  await district(page, '54').click();
  await expect(card(page, 'Sylhet')).toBeVisible();
  await expect(card(page, 'Sylhet').locator('svg.stamp')).toBeVisible();
  await expect(card(page, 'Sylhet').locator('svg.stamp-impact')).toHaveCount(0);
  await expect(page.getByText('New stamp')).toHaveCount(0);
  await expect(page.locator('.overlay-selected-ink')).toHaveCount(0);
  await expect(page.locator('.overlay-selection')).not.toHaveAttribute('data-inking');
  await expect(page.locator('header .count[data-prev]')).toHaveCount(0);
  expect(await page.getByRole('status').textContent()).toBe('Sylhet passport page open.');
});

test('with reduced motion a first discovery only fades: nothing moves or waits, and every state is there', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/');
  await district(page, '54').click();
  await expect(card(page, 'Sylhet')).toBeVisible();
  const running = await page.evaluate(() => document.getAnimations().filter(a => a instanceof CSSAnimation).map(a => a.animationName));
  expect(running.filter(name => name !== 'fade-in')).toEqual([]);
  expect(await page.locator('svg.stamp-impact').evaluate(el => getComputedStyle(el).animationDelay)).toBe('0s');
  await expect(card(page, 'Sylhet').getByText('New stamp')).toBeVisible();
  expect(await countText(page)).toBe('1');
  await expect(page.locator('.overlay-selected-ink')).toHaveCount(1); // the district is inked at once
  expect(await page.locator('.overlay-selected-ink').evaluate(el => el.getAnimations().length)).toBe(0);
  expect(await cssAnimations(card(page, 'Sylhet').locator('.passport-page'))).not.toContain('settle');
  await atRest(page);
});

test('switching districts while the card is open updates it in place and replays no entrance', async ({ page }) => {
  await page.addInitScript(seed => localStorage.setItem('bd-discovery-passport:v1', JSON.stringify(seed)), SEEDED);
  await page.goto('/');
  await district(page, '54').click();
  const sylhet = card(page, 'Sylhet');
  await expect(sylhet).toBeVisible();
  await atRest(page);
  await sylhet.evaluate(el => (window.__card = el));

  await sylhet.getByRole('button', { name: /^Sunamganj/ }).click(); // from the page itself, so on a phone the sheet is open throughout
  await expect(page.locator('#passport-title')).toHaveText('Sunamganj'); // the contents are there at once
  expect(await page.evaluate(() => window.__card === document.querySelector('.passport')), 'the card stays mounted').toBe(true);
  expect(await cssAnimations(page.locator('.passport')), 'no entrance of the page, the sheet or its groups').toEqual([]);
  expect(await page.locator('.passport').evaluate(el => el.hasAttribute('data-settle'))).toBe(false);
});

test('the phone sheet keeps its handle and drags down to close', async ({ page, isMobile }) => {
  test.skip(!isMobile, 'the sheet is a phone layout');
  await page.goto('/?district=54');
  const sheet = card(page, 'Sylhet');
  await expect(sheet).toBeVisible();
  await atRest(page);
  const handle = page.locator('.sheet-handle');
  const box = await handle.boundingBox();
  expect(box.height, 'a thumb-sized strip to grab').toBeGreaterThanOrEqual(20);
  expect(await sheet.evaluate(el => getComputedStyle(el.querySelector('.passport-page')).overflowY)).toBe('auto'); // the page scrolls inside the sheet
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width / 2, box.y + 400, { steps: 8 });
  await page.mouse.up();
  await expect(sheet).toHaveCount(0);
});
