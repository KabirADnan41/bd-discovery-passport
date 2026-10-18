import { readFileSync } from 'node:fs';
import { test, expect } from './fixtures.js';

// The trip on the map in Plan mode: a pin per district and a dashed route per day, at district level only.
const TRIP_KEY = 'bd-discovery-passport:trip:v1';
const NOTE = 'Pins and lines are approximate. Use each day’s Directions for the real route.';
const KEY_PIN = 'Trip stop, by district (a number shows several stops there)';
const KEY_ROUTE = 'Approximate route by day, district to district, not roads';
const place = id => ({ kind: 'place', id });
const BICHANAKANDI = place('54-bichanakandi'); // Sylhet, district 54
const LALAKHAL = place('54-lalakhal');
const STAR_MOSQUE = place('1-star-mosque'); // Dhaka, district 1
const INANI_BEACH = place('45-inani-beach'); // Cox's Bazar, district 45
const PATENGA = place('43-patenga-sea-beach'); // Chattogram, district 43

// Where a pin must sit: the district's own anchor on the map, never a made-up point.
const LABELS = Object.fromEntries(
  JSON.parse(readFileSync(new URL('../../src/generated/districtPaths.generated.json', import.meta.url), 'utf8')).districts.map(d => [d.id, d.label]),
);
const at = id => LABELS[id].join(',');

async function startWithTrip(page, days) {
  await page.evaluate(([key, value]) => localStorage.setItem(key, value), [TRIP_KEY, JSON.stringify({ name: '', days })]);
  await page.goto('/');
}
const openPlanner = async page => {
  await page.getByRole('tab', { name: /^Plan/ }).click();
  await expect(page.getByRole('tab', { name: /^Plan/ })).toHaveAttribute('aria-selected', 'true');
};
const overlay = page => page.locator('.trip-overlay');
const pinOf = (page, districtId) => overlay(page).locator(`[data-trip-pin="${districtId}"]`);
const showOnMap = (page, day) => page.getByRole('button', { name: `Show on map: day ${day}`, exact: true });
const backToDay = (page, day) => page.getByRole('button', { name: `Back to day ${day}`, exact: true });
const mapSection = page => page.locator('#map-section');
// How far an element's top edge is from the top of the screen: 0 once it has been scrolled to the start.
const distanceFromTop = locator => locator.evaluate(el => Math.abs(Math.round(el.getBoundingClientRect().top)));

test.beforeEach(async ({ page }) => {
  await page.goto('/');
});

test('Plan mode pins each district once with its stop count, and draws a route only for a day that visits two districts', async ({ page }) => {
  await startWithTrip(page, [[BICHANAKANDI, LALAKHAL, STAR_MOSQUE], [INANI_BEACH]]);
  await openPlanner(page);

  await expect(overlay(page)).toHaveAttribute('aria-hidden', 'true');
  await expect(overlay(page).locator('[data-trip-pin]')).toHaveCount(3);
  for (const [id, count] of [['54', 2], ['1', 1], ['45', 1]]) {
    const pin = pinOf(page, id);
    await expect(pin).toHaveAttribute('data-count', String(count));
    await expect(pin.locator('circle')).toHaveAttribute('cx', String(LABELS[id][0]));
    await expect(pin.locator('circle')).toHaveAttribute('cy', String(LABELS[id][1]));
    await expect(pin.locator('text')).toHaveCount(count > 1 ? 1 : 0); // a number only where there are several stops
  }
  await expect(pinOf(page, '54').locator('text')).toHaveText('2');

  // day 1 runs Sylhet to Dhaka; day 2 has one district, so it has a pin and no line, and no line joins the days
  const lines = overlay(page).locator('polyline');
  await expect(lines).toHaveCount(1);
  await expect(lines).toHaveAttribute('data-trip-day', '1');
  await expect(lines).toHaveAttribute('points', `${at('54')} ${at('1')}`);
});

test('a route is drawn in the river-blue token over a paper casing, and not in ink', async ({ page }) => {
  await startWithTrip(page, [[BICHANAKANDI, STAR_MOSQUE]]);
  await openPlanner(page);
  const colours = await page.evaluate(() => {
    const probe = document.createElement('i');
    document.body.append(probe);
    const resolved = name => {
      probe.style.color = `var(${name})`;
      return getComputedStyle(probe).color;
    };
    const out = { river: resolved('--route-river'), ink: resolved('--text-primary'), paper: resolved('--surface-paper') };
    probe.remove();
    const stroke = sel => getComputedStyle(document.querySelector(sel)).stroke;
    return { ...out, line: stroke('.trip-overlay polyline'), casing: stroke('.trip-overlay .trip-casing') };
  });
  expect(colours.line).toBe(colours.river);
  expect(colours.line).not.toBe(colours.ink);
  expect(colours.casing).toBe(colours.paper);
  await expect(overlay(page).locator('.trip-casing')).toHaveCount(1); // one casing per route, under it
});

test('a day that ends in one district and a day that starts in another are two routes, never one line', async ({ page }) => {
  await startWithTrip(page, [[BICHANAKANDI, STAR_MOSQUE], [INANI_BEACH, PATENGA]]);
  await openPlanner(page);

  const lines = overlay(page).locator('polyline');
  await expect(lines).toHaveCount(2);
  await expect(lines.nth(0)).toHaveAttribute('data-trip-day', '1');
  await expect(lines.nth(1)).toHaveAttribute('data-trip-day', '2');
  const [day1, day2] = [await lines.nth(0).getAttribute('points'), await lines.nth(1).getAttribute('points')];
  expect(day1).toBe(`${at('54')} ${at('1')}`);
  expect(day2).toBe(`${at('45')} ${at('43')}`);
  for (const id of ['45', '43']) expect(day1).not.toContain(at(id));
  for (const id of ['54', '1']) expect(day2).not.toContain(at(id));
});

test('Explore and Quiz never show the trip on the map, and Plan shows it only while the trip has stops', async ({ page }) => {
  await startWithTrip(page, [[BICHANAKANDI, STAR_MOSQUE]]);
  await expect(page.locator('.map-svg')).toBeVisible();
  await expect(overlay(page)).toHaveCount(0); // explore, with a trip saved

  await openPlanner(page);
  await expect(overlay(page)).toHaveCount(1);
  await page.getByRole('tab', { name: /^Explore/ }).click();
  await expect(overlay(page)).toHaveCount(0);

  await openPlanner(page);
  await expect(overlay(page)).toHaveCount(1);
  await page.getByRole('tab', { name: /^Quiz/ }).click();
  await expect(page.locator('.quiz-progress')).toContainText('Question 1 of 10');
  await expect(overlay(page)).toHaveCount(0);

  await page.evaluate(key => localStorage.removeItem(key), TRIP_KEY);
  await page.goto('/');
  await openPlanner(page);
  await expect(page.getByText('Your trip is empty.')).toBeVisible();
  await expect(overlay(page)).toHaveCount(0); // plan mode, but no stops
  await expect(page.getByText(NOTE)).toHaveCount(0);
});

test('Plan mode explains the pins and lines: two legend items and a note about the real route', async ({ page }) => {
  await startWithTrip(page, [[BICHANAKANDI, STAR_MOSQUE]]);
  const key = page.getByRole('list', { name: 'Map key' });
  await expect(key).toContainText('Not yet discovered');
  await expect(key).not.toContainText(KEY_PIN); // explore mode has neither
  await expect(page.getByText(NOTE)).toHaveCount(0);

  await openPlanner(page);
  await expect(key).toContainText('Not yet discovered'); // the explore items stay
  await expect(key).toContainText(KEY_PIN);
  await expect(key).toContainText(KEY_ROUTE);
  await expect(page.getByText(NOTE)).toBeVisible();
});

test('the pins and lines do not take clicks: a pinned district still opens its passport page', async ({ page }) => {
  await startWithTrip(page, [[BICHANAKANDI, LALAKHAL, STAR_MOSQUE]]);
  await openPlanner(page);
  const circle = pinOf(page, '54').locator('circle');
  await expect(circle).toBeVisible();
  const card = page.getByRole('dialog', { name: 'Sylhet' });

  await page.locator('[data-district-id="54"]').click(); // Playwright fails this click if anything else would receive it
  await expect(card).toBeVisible();
  await card.getByRole('button', { name: 'Close' }).click();
  await expect(card).toBeHidden();

  // and a real click right on the pin lands on the district under it
  await circle.scrollIntoViewIfNeeded();
  const box = await circle.boundingBox();
  await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
  await expect(card).toBeVisible();
});

test('on a phone, Show on map jumps to the map and Back to day returns to that day’s button', async ({ page, isMobile }) => {
  test.skip(!isMobile, 'phones only');
  await startWithTrip(page, [[BICHANAKANDI, LALAKHAL, STAR_MOSQUE], [INANI_BEACH], []]);
  await openPlanner(page);
  await expect(showOnMap(page, 3)).toHaveCount(0); // an empty day has nothing to show
  await expect(backToDay(page, 1)).toHaveCount(0);

  for (const day of [1, 2]) {
    await showOnMap(page, day).click();
    await expect(mapSection(page)).toBeFocused();
    await expect.poll(() => distanceFromTop(mapSection(page))).toBeLessThanOrEqual(1); // the map is at the top of the screen
    await expect(backToDay(page, day)).toBeInViewport({ ratio: 1 }); // not cut off above the top edge
    await expect(page.getByRole('button', { name: /^Back to day/ })).toHaveCount(1);

    await backToDay(page, day).click();
    await expect(showOnMap(page, day)).toBeFocused();
    await expect.poll(() => distanceFromTop(showOnMap(page, day))).toBeLessThanOrEqual(1);
    await expect(page.getByRole('button', { name: /^Back to day/ })).toHaveCount(0); // used once, then gone
  }
});

test('with reduced motion the jump to the map and back is instant', async ({ page, isMobile }) => {
  test.skip(!isMobile, 'phones only');
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await startWithTrip(page, [[BICHANAKANDI, STAR_MOSQUE]]);
  await openPlanner(page);

  await showOnMap(page, 1).click();
  expect(await distanceFromTop(mapSection(page))).toBeLessThanOrEqual(1); // already there: no waiting for an animation
  await expect(backToDay(page, 1)).toBeInViewport({ ratio: 1 });
  await backToDay(page, 1).click();
  expect(await distanceFromTop(showOnMap(page, 1))).toBeLessThanOrEqual(1);
});

test('on a desktop there is no Show on map button', async ({ page, isMobile }) => {
  test.skip(isMobile, 'desktop only');
  await startWithTrip(page, [[BICHANAKANDI, STAR_MOSQUE], [INANI_BEACH]]);
  await openPlanner(page);
  await expect(page.getByRole('heading', { name: /^Day 2/ })).toBeVisible();
  await expect(page.getByRole('button', { name: /^Show on map/ })).toHaveCount(0);
  await expect(page.getByRole('button', { name: /^Back to day/ })).toHaveCount(0);
});

test('the route reads as river blue: its line is the main stroke and the paper casing only a thin edge, under a pin', async ({ page }) => {
  await page.addInitScript(t => localStorage.setItem('bd-discovery-passport:trip:v1', t), JSON.stringify({
    name: '',
    days: [[{ kind: 'place', id: '43-patenga-sea-beach' }, { kind: 'place', id: '45-inani-beach' }]],
  }));
  await page.goto('/');
  await page.getByRole('tab', { name: /^Plan/ }).click();
  const width = sel => page.locator(sel).first().evaluate(el => parseFloat(getComputedStyle(el).strokeWidth));
  const line = await width('.trip-overlay polyline');
  const casing = await width('.trip-overlay .trip-casing');
  const pin = await page.locator('.trip-overlay circle').first().evaluate(el => 2 * el.r.baseVal.value);
  expect(casing).toBeGreaterThan(line); // a paper edge stays on both sides
  expect(line / casing).toBeGreaterThanOrEqual(0.6); // the blue line, not its casing, is most of the route's width
  expect(line).toBeLessThan(pin / 2); // and it stays well under a pin
});
