import { readFileSync } from 'node:fs';
import { test, expect } from './fixtures.js';

// Drag to reorder in the planner: a stop is held by its grip (pointer only) and dropped where it should go.
const TRIP_KEY = 'bd-discovery-passport:trip:v1';
const place = id => ({ kind: 'place', id });
const BICHANAKANDI = place('54-bichanakandi'); // Sylhet, district 54
const LALAKHAL = place('54-lalakhal');
const STAR_MOSQUE = place('1-star-mosque'); // Dhaka, district 1
const INANI_BEACH = place('45-inani-beach'); // Cox's Bazar, district 45
// Ten real places outside Sylhet, as in planner.spec.js: a full day of stops the planner keeps.
const OTHERS = Object.values(JSON.parse(readFileSync(new URL('../../src/data/places.json', import.meta.url), 'utf8')))
  .flat()
  .filter(p => !p.id.startsWith('54-'))
  .slice(0, 10)
  .map(p => place(p.id));
// Where the map anchors a district, as in trip-map.spec.js.
const LABELS = Object.fromEntries(
  JSON.parse(readFileSync(new URL('../../src/generated/districtPaths.generated.json', import.meta.url), 'utf8')).districts.map(d => [d.id, d.label]),
);
const routeThrough = (...ids) => ids.map(id => LABELS[id].join(',')).join(' ');

const rawTrip = page => page.evaluate(key => localStorage.getItem(key), TRIP_KEY);
const savedDays = async page => JSON.parse(await rawTrip(page))?.days;
// Opens the planner with this trip already saved, as if the user had built it on an earlier visit.
async function startPlanning(page, days) {
  const saved = JSON.stringify({ name: '', days });
  await page.evaluate(([key, value]) => localStorage.setItem(key, value), [TRIP_KEY, saved]);
  await page.goto('/');
  await openPlanner(page);
  return saved;
}
const openPlanner = async page => {
  await page.getByRole('tab', { name: /^Plan/ }).click();
  await expect(page.getByRole('tab', { name: /^Plan/ })).toHaveAttribute('aria-selected', 'true');
};
const planner = page => page.getByRole('region', { name: /^Your trip/ });
const dayOf = (page, n) => planner(page).locator('section', { has: page.getByRole('heading', { name: new RegExp(`^Day ${n}(?!\\d)`) }) });
const stopsOf = (page, n) => dayOf(page, n).getByRole('listitem');
const gripOf = row => row.locator('.trip-grip');
const status = page => page.getByRole('status');
const dropLines = page => planner(page).locator('[data-drop]');

// Presses the mouse on a stop's grip; returns where the pointer is, to move it on from there.
async function hold(page, row) {
  await expect(gripOf(row)).toBeVisible();
  const box = await gripOf(row).boundingBox();
  const x = box.x + box.width / 2;
  await page.mouse.move(x, box.y + box.height / 2);
  await page.mouse.down();
  return x;
}
const moveTo = (page, x, y) => page.mouse.move(x, y, { steps: 8 }); // in steps, as a hand moves
const topOf = async row => (await row.boundingBox()).y;
const bottomOf = async row => {
  const box = await row.boundingBox();
  return box.y + box.height;
};

test.beforeEach(async ({ page }) => {
  await page.goto('/');
});

test('dragging the third stop to the top of its day saves 3, 1, 2, announces it and survives a reload', async ({ page, isMobile }) => {
  test.skip(isMobile, 'the phone does the same move with a real finger, below');
  await startPlanning(page, [[BICHANAKANDI, STAR_MOSQUE, INANI_BEACH]]);
  const stops = stopsOf(page, 1);
  const x = await hold(page, stops.nth(2));
  await moveTo(page, x, (await topOf(stops.first())) + 4);
  await expect(stops.nth(2)).toHaveAttribute('data-lifted', 'true');
  await expect(stops.first()).toHaveAttribute('data-drop', 'before'); // the line on the top edge of the first stop
  await expect(dropLines(page)).toHaveCount(1);
  await page.mouse.up();

  await expect(stops).toHaveText([/^Inani Beach/, /^Bichanakandi/, /^Star Mosque/]);
  await expect(status(page)).toHaveText('Moved Inani Beach to day 1, stop 1.');
  await expect(dropLines(page)).toHaveCount(0);
  expect(await savedDays(page)).toEqual([[INANI_BEACH, BICHANAKANDI, STAR_MOSQUE]]);

  await page.reload(); // the mode is not in the URL, so the page opens in explore mode
  await openPlanner(page);
  await expect(stops).toHaveText([/^Inani Beach/, /^Bichanakandi/, /^Star Mosque/]);
});

test('a drop line is a river-blue line on the edge, and the dropped stop reaches its settled end state', async ({ page, isMobile }) => {
  test.skip(isMobile, 'mouse drag; the phone drag is below');
  await startPlanning(page, [[BICHANAKANDI, STAR_MOSQUE, INANI_BEACH]]);
  const stops = stopsOf(page, 1);
  const x = await hold(page, stops.nth(2));
  await moveTo(page, x, (await topOf(stops.first())) + 4);
  await expect(stops.first()).toHaveAttribute('data-drop', 'before');
  const line = await stops.first().evaluate(el => {
    const style = getComputedStyle(el, '::after');
    return { height: style.height, colour: style.backgroundColor, position: style.position };
  });
  const river = await page.evaluate(() => {
    const probe = document.createElement('i');
    probe.style.color = 'var(--route-river)';
    document.body.append(probe);
    const colour = getComputedStyle(probe).color;
    probe.remove();
    return colour;
  });
  expect(line).toEqual({ height: '3px', colour: river, position: 'absolute' }); // out of the flow: no layout shift
  await page.mouse.up();

  const moved = stops.first(); // Inani Beach, now first
  await expect(moved).toHaveText(/^Inani Beach/);
  await expect(moved).not.toHaveAttribute('data-settled', /.*/, { timeout: 4000 }); // the settle ran and cleared itself
  await expect(moved).not.toHaveAttribute('data-lifted');
  await expect(dropLines(page)).toHaveCount(0);
});

test('under reduced motion a dropped stop runs no settle animation', async ({ page, isMobile }) => {
  test.skip(isMobile, 'mouse drag');
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await startPlanning(page, [[BICHANAKANDI, STAR_MOSQUE, INANI_BEACH]]);
  const stops = stopsOf(page, 1);
  const x = await hold(page, stops.nth(2));
  await moveTo(page, x, (await topOf(stops.first())) + 4);
  await expect(stops.first()).toHaveAttribute('data-drop', 'before');
  expect(await stops.first().evaluate(el => getComputedStyle(el, '::after').animationName)).toBe('none');
  await page.mouse.up();

  await expect(stops).toHaveText([/^Inani Beach/, /^Bichanakandi/, /^Star Mosque/]); // the end state is there at once
  expect(await stops.first().evaluate(el => getComputedStyle(el).animationName)).toBe('none');
  expect(await stops.first().evaluate(el => el.getAnimations().length)).toBe(0);
});

test('a stop dragged from day 1 into day 2, between its stops, is saved in that order', async ({ page }) => {
  await startPlanning(page, [
    [BICHANAKANDI, LALAKHAL],
    [STAR_MOSQUE, INANI_BEACH],
  ]);
  const x = await hold(page, stopsOf(page, 1).first());
  await moveTo(page, x, (await topOf(stopsOf(page, 2).nth(1))) + 4); // just above Inani Beach's middle: after Star Mosque
  await expect(stopsOf(page, 2).nth(1)).toHaveAttribute('data-drop', 'before');
  await page.mouse.up();

  await expect(stopsOf(page, 1)).toHaveText([/^Lalakhal/]);
  await expect(stopsOf(page, 2)).toHaveText([/^Star Mosque/, /^Bichanakandi/, /^Inani Beach/]);
  await expect(status(page)).toHaveText('Moved Bichanakandi to day 2, stop 2.');
  expect(await savedDays(page)).toEqual([[LALAKHAL], [STAR_MOSQUE, BICHANAKANDI, INANI_BEACH]]);
});

test('a stop dropped back on its own place changes and announces nothing', async ({ page }) => {
  const saved = await startPlanning(page, [[BICHANAKANDI, LALAKHAL, STAR_MOSQUE]]);
  const lalakhal = stopsOf(page, 1).nth(1);
  const x = await hold(page, lalakhal);
  await moveTo(page, x, (await topOf(lalakhal)) + 30); // still on its own row
  await expect(lalakhal).toHaveAttribute('data-lifted', 'true');
  await expect(dropLines(page)).toHaveCount(0); // no line where nothing would change
  await page.mouse.up();

  await expect(lalakhal).not.toHaveAttribute('data-lifted');
  expect(await rawTrip(page)).toBe(saved);
  await expect(status(page)).toHaveText('Plan mode.');
});

test('Escape in the middle of a drag cancels it: the stop stays and nothing is saved', async ({ page }) => {
  const saved = await startPlanning(page, [[BICHANAKANDI, LALAKHAL, STAR_MOSQUE]]);
  const stops = stopsOf(page, 1);
  const x = await hold(page, stops.nth(2));
  await moveTo(page, x, (await topOf(stops.first())) + 4);
  await expect(dropLines(page)).toHaveCount(1);
  await page.keyboard.press('Escape');
  await expect(dropLines(page)).toHaveCount(0);
  await expect(planner(page).locator('[data-lifted]')).toHaveCount(0);
  await moveTo(page, x, (await topOf(stops.first())) + 6);
  await page.mouse.up(); // the release after Escape drops nothing

  await expect(stops).toHaveText([/^Bichanakandi/, /^Lalakhal/, /^Star Mosque/]);
  expect(await rawTrip(page)).toBe(saved);
  await expect(status(page)).toHaveText('Plan mode.');
});

test('a full day shows no drop line and takes no stop', async ({ page }) => {
  const saved = await startPlanning(page, [[BICHANAKANDI], OTHERS]);
  const x = await hold(page, stopsOf(page, 1).first());
  await moveTo(page, x, (await topOf(stopsOf(page, 2).nth(1))) + 4);
  await expect(stopsOf(page, 1).first()).toHaveAttribute('data-lifted', 'true');
  await expect(dropLines(page)).toHaveCount(0);
  await page.mouse.up();

  await expect(stopsOf(page, 1)).toHaveText([/^Bichanakandi/]);
  expect(await rawTrip(page)).toBe(saved);
  await expect(status(page)).toHaveText('Plan mode.');
});

test('the grip is hidden from assistive technology and never takes focus; Move up and Move down stay', async ({ page }) => {
  await startPlanning(page, [[BICHANAKANDI, LALAKHAL]]);
  const grip = gripOf(stopsOf(page, 1).first());
  await expect(grip).toHaveAttribute('aria-hidden', 'true');
  await expect(grip).not.toHaveAttribute('tabindex');
  const takesFocus = await grip.evaluate(el => {
    el.focus();
    return document.activeElement === el;
  });
  expect(takesFocus).toBe(false);
  for (const name of ['Move up: Bichanakandi', 'Move down: Bichanakandi', 'Move up: Lalakhal', 'Move down: Lalakhal']) {
    await expect(page.getByRole('button', { name, exact: true })).toBeVisible();
  }
});

test('after a drag, the day’s route on the map follows the new order', async ({ page }) => {
  await startPlanning(page, [[BICHANAKANDI, STAR_MOSQUE, INANI_BEACH]]);
  const route = page.locator('.trip-overlay polyline[data-trip-day="1"]');
  await expect(route).toHaveAttribute('points', routeThrough('54', '1', '45'));
  const stops = stopsOf(page, 1);
  const x = await hold(page, stops.first());
  await moveTo(page, x, (await bottomOf(stops.nth(2))) - 4); // below the last stop's middle: the end of the day
  await expect(stops.nth(2)).toHaveAttribute('data-drop', 'after'); // the line on the bottom edge of the last stop
  await page.mouse.up();

  await expect(stops).toHaveText([/^Star Mosque/, /^Inani Beach/, /^Bichanakandi/]);
  await expect(status(page)).toHaveText('Moved Bichanakandi to day 1, stop 3.');
  await expect(route).toHaveAttribute('points', routeThrough('1', '45', '54'));
});

test('on a phone, a real finger drags the third stop to the top of its day', async ({ page, isMobile }) => {
  test.skip(!isMobile, 'touch input');
  await startPlanning(page, [[BICHANAKANDI, STAR_MOSQUE, INANI_BEACH]]);
  const stops = stopsOf(page, 1);
  await expect(gripOf(stops.nth(2))).toBeVisible();
  const grip = await gripOf(stops.nth(2)).boundingBox();
  const [x, y0] = [grip.x + grip.width / 2, grip.y + grip.height / 2];
  const y1 = (await topOf(stops.first())) + 4;
  // Real touch input through the DevTools protocol: Playwright's touchscreen can only tap.
  const cdp = await page.context().newCDPSession(page);
  const touch = (type, y) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: type === 'touchEnd' ? [] : [{ x, y }] });
  await touch('touchStart', y0);
  for (let step = 1; step <= 8; step++) await touch('touchMove', y0 + ((y1 - y0) * step) / 8);
  await expect(stops.first()).toHaveAttribute('data-drop', 'before');
  await touch('touchEnd');

  await expect(stops).toHaveText([/^Inani Beach/, /^Bichanakandi/, /^Star Mosque/]);
  await expect(status(page)).toHaveText('Moved Inani Beach to day 1, stop 1.');
  expect(await savedDays(page)).toEqual([[INANI_BEACH, BICHANAKANDI, STAR_MOSQUE]]);
});
