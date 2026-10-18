import AxeBuilder from '@axe-core/playwright';
import { test, expect } from './fixtures.js';

// Share a trip by link (?trip=…). The link is untrusted: it is checked whole before any of it is used, names come from
// the local place data, opening it stores nothing, and only "Save this trip" or a confirmed "Replace my trip" keeps it.
const TRIP_KEY = 'bd-discovery-passport:trip:v1';
const MAX_SHARE_LENGTH = 10 * 10 * 65; // MAX_SHARE_LENGTH in src/lib/tripShare.js (app modules are not imported here)
const INVALID = 'This trip link is not valid, so nothing was loaded.';
const place = id => ({ kind: 'place', id });
const BICHANAKANDI = place('54-bichanakandi');
const LALAKHAL = place('54-lalakhal');
const STAR_MOSQUE = place('1-star-mosque');
const INANI_BEACH = place('45-inani-beach');
const PATENGA = place('43-patenga-sea-beach');

// A shared trip of three places over two days, and a different trip already saved on this browser.
const SHARED = '54-bichanakandi.1-star-mosque_45-inani-beach';
const SHARED_DAYS = [[BICHANAKANDI, STAR_MOSQUE], [INANI_BEACH]];
const SHARED_LINES = ['Day 1: Bichanakandi → Star Mosque', 'Day 2: Inani Beach'];
const LOCAL_DAYS = [[LALAKHAL], [PATENGA]];
const LOCAL_LINK = '54-lalakhal_43-patenga-sea-beach';

const rawTrip = page => page.evaluate(key => localStorage.getItem(key), TRIP_KEY);
// Saves a trip as if it had been built on an earlier visit, and returns the stored string. It is pretty-printed: the app
// saves compact JSON, so if anything re-saved even the same trip, the "stores nothing" checks would see the change.
async function saveLocalTrip(page, days) {
  const saved = JSON.stringify({ name: '', days }, null, 1);
  await page.evaluate(([key, value]) => localStorage.setItem(key, value), [TRIP_KEY, saved]);
  return saved;
}
const openPlanner = async page => {
  await page.getByRole('tab', { name: /^Plan/ }).click();
  await expect(page.getByRole('tab', { name: /^Plan/ })).toHaveAttribute('aria-selected', 'true');
};
const planner = page => page.getByRole('region', { name: /^Your trip/ });
const notice = page => page.getByRole('region', { name: 'A shared trip' });
const stopsOf = (page, n) =>
  planner(page)
    .locator('section', { has: page.getByRole('heading', { name: new RegExp(`^Day ${n}(?!\\d)`) }) })
    .getByRole('listitem');
const shareButton = page => planner(page).getByRole('button', { name: 'Share trip', exact: true });
const plannerHeading = page => planner(page).getByRole('heading', { name: /^Your trip/ });
const status = page => page.getByRole('status');
const tripParam = page => new URL(page.url()).searchParams.getAll('trip');
const rejectCopies = page =>
  page.addInitScript(() => {
    navigator.clipboard.writeText = () => Promise.reject(new DOMException('Write permission denied.', 'NotAllowedError'));
  });
// As in accessibility.spec.js.
const scan = async page => {
  const { violations } = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa']).analyze();
  return violations.map(v => `${v.id} (${v.impact}): ${v.nodes.map(n => n.target.join(' ')).slice(0, 3).join(', ')}`);
};

test.beforeEach(async ({ page }) => {
  await page.goto('/');
});

test('Share trip copies a link to this page that holds only the trip’s ids, with empty days left out', async ({ page, context, baseURL }) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  const saved = await saveLocalTrip(page, [[BICHANAKANDI, LALAKHAL], [], [PATENGA]]);
  await page.goto('/');
  await openPlanner(page);
  await shareButton(page).click();
  await expect(status(page)).toHaveText('Trip link copied.');
  expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(`${baseURL}/?trip=54-bichanakandi.54-lalakhal_43-patenga-sea-beach`);
  await expect(planner(page).getByRole('textbox', { name: 'Trip link' })).toHaveCount(0); // the copy worked, so no fallback
  expect(await rawTrip(page)).toBe(saved); // sharing stores nothing
});

test('Share trip shows a visible "Link copied" that goes away by itself, and the screen reader hears it once', async ({ page, context }) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  await saveLocalTrip(page, LOCAL_DAYS);
  await page.goto('/');
  await openPlanner(page);
  const copied = planner(page).getByText('Link copied', { exact: true });
  await expect(copied).toHaveCount(0);
  const before = await shareButton(page).boundingBox();
  await shareButton(page).click();
  await expect(copied).toBeVisible();
  await expect(copied).toHaveAttribute('aria-hidden', 'true'); // the status region says it, so the picture does not
  await expect(status(page)).toHaveText('Trip link copied.');
  expect(await shareButton(page).boundingBox()).toEqual(before); // nothing moved
  await expect(shareButton(page)).toBeFocused(); // focus stayed on the button
  await expect(copied).toHaveCount(0, { timeout: 6000 });
});

test('a shared-trip preview has a Bengali subtitle under its heading', async ({ page }) => {
  await page.goto(`/?trip=${SHARED}`);
  const subtitle = notice(page).getByRole('heading', { name: /^A shared trip/ }).locator('[lang="bn"]');
  await expect(subtitle).toHaveText('শেয়ার করা ভ্রমণ');
});

test('if the copy fails, the same link shows in a read-only field, selected, and nothing is stored', async ({ page, baseURL }) => {
  await rejectCopies(page);
  const saved = await saveLocalTrip(page, LOCAL_DAYS);
  await page.goto('/');
  await openPlanner(page);
  await shareButton(page).click();
  const link = `${baseURL}/?trip=${LOCAL_LINK}`;
  const field = planner(page).getByRole('textbox', { name: 'Trip link' });
  await expect(field).toHaveValue(link);
  await expect(field).toHaveAttribute('readonly', '');
  await expect(field).toBeFocused();
  expect(await field.evaluate(el => [el.selectionStart, el.selectionEnd])).toEqual([0, link.length]);
  await expect(status(page)).toHaveText('Copy the trip link below.');
  expect(await rawTrip(page)).toBe(saved);
});

test('a valid link with no trip here opens a preview in Plan mode, stores nothing, and Save this trip keeps exactly it', async ({ page }) => {
  await page.goto(`/?trip=${SHARED}`);
  await expect(page.getByRole('tab', { name: /^Plan/ })).toHaveAttribute('aria-selected', 'true');
  await expect(notice(page).getByRole('listitem')).toHaveText(SHARED_LINES); // local names, never text from the link
  expect(await rawTrip(page)).toBeNull();
  await expect(page.locator('.trip-overlay')).toHaveCount(0); // the map shows only a trip that is kept here
  await expect(shareButton(page)).toHaveCount(0); // nothing to share yet

  await notice(page).getByRole('button', { name: 'Save this trip' }).click();
  await expect(status(page)).toHaveText('Saved the shared trip.');
  await expect(notice(page)).toHaveCount(0);
  expect(JSON.parse(await rawTrip(page))).toEqual({ name: '', days: SHARED_DAYS });
  expect(tripParam(page)).toEqual([]);
  await expect(stopsOf(page, 1)).toHaveText([/^Bichanakandi/, /^Star Mosque/]);
  await expect(stopsOf(page, 2)).toHaveText([/^Inani Beach/]);
  await expect(page.locator('.trip-overlay [data-trip-pin]')).toHaveCount(3); // Sylhet, Dhaka and Cox's Bazar
  await expect(plannerHeading(page)).toBeFocused(); // the button that was pressed has gone

  await page.reload(); // the link has left the address, so it is not offered again
  await openPlanner(page);
  await expect(stopsOf(page, 1)).toHaveText([/^Bichanakandi/, /^Star Mosque/]);
  await expect(notice(page)).toHaveCount(0);
});

test('a valid link over a trip saved here changes nothing until Replace my trip is confirmed', async ({ page }) => {
  const saved = await saveLocalTrip(page, LOCAL_DAYS);
  await page.goto(`/?trip=${SHARED}`);
  await expect(notice(page).getByRole('listitem')).toHaveText(SHARED_LINES);
  await expect(notice(page).getByRole('button', { name: 'Save this trip' })).toHaveCount(0); // a trip is here, so the choice is to replace it
  await expect(stopsOf(page, 1)).toHaveText([/^Lalakhal/]);
  expect(await rawTrip(page)).toBe(saved); // opening the link stored nothing

  const replace = notice(page).getByRole('button', { name: 'Replace my trip' });
  const dialog = page.getByRole('dialog', { name: 'Replace your trip?' });
  await replace.click();
  await expect(dialog).toContainText('Your current trip will be replaced by the shared one on this browser. It cannot be undone.');
  await dialog.getByRole('button', { name: 'Keep my trip' }).click();
  await expect(dialog).toBeHidden();
  expect(await rawTrip(page)).toBe(saved);
  await expect(notice(page).getByRole('listitem')).toHaveText(SHARED_LINES); // still on offer
  await expect(stopsOf(page, 1)).toHaveText([/^Lalakhal/]);
  await expect(stopsOf(page, 2)).toHaveText([/^Patenga Sea Beach/]);
  await expect(replace).toBeFocused(); // back where it was
  expect(tripParam(page)).toEqual([SHARED]);

  await replace.click();
  await dialog.getByRole('button', { name: 'Replace my trip' }).click();
  await expect(status(page)).toHaveText('Saved the shared trip.');
  await expect(notice(page)).toHaveCount(0);
  expect(JSON.parse(await rawTrip(page))).toEqual({ name: '', days: SHARED_DAYS });
  await expect(stopsOf(page, 1)).toHaveText([/^Bichanakandi/, /^Star Mosque/]);
  await expect(plannerHeading(page)).toBeFocused();
  expect(tripParam(page)).toEqual([]);
});

test('Dismiss leaves the trip here alone and takes only the link out of the address, so a reload offers nothing', async ({ page }) => {
  const saved = await saveLocalTrip(page, LOCAL_DAYS);
  await page.goto(`/?trip=${SHARED}`);
  await expect(notice(page).getByRole('listitem')).toHaveText(SHARED_LINES);
  await page.getByRole('tab', { name: /^Explore/ }).click(); // the link stays on offer until a choice is made
  await openPlanner(page);
  await expect(notice(page).getByRole('listitem')).toHaveText(SHARED_LINES);
  await notice(page).getByRole('button', { name: 'Dismiss' }).click();
  await expect(notice(page)).toHaveCount(0);
  await expect(stopsOf(page, 1)).toHaveText([/^Lalakhal/]);
  await expect(plannerHeading(page)).toBeFocused();
  expect(tripParam(page)).toEqual([]);
  expect(await rawTrip(page)).toBe(saved);

  await page.reload();
  await openPlanner(page);
  await expect(notice(page)).toHaveCount(0);
  await expect(stopsOf(page, 1)).toHaveText([/^Lalakhal/]);
  expect(await rawTrip(page)).toBe(saved);
});

test('a malformed or ambiguous link says it is not valid, shows nothing from it and changes nothing', async ({ page }) => {
  const saved = await saveLocalTrip(page, LOCAL_DAYS);
  const malformed = [
    ['an empty value', ''],
    ['bad characters', '%3Cscript%3E'],
    ['an unknown place', '54-gone-place'],
    ['a duplicate stop', '54-bichanakandi.54-bichanakandi'],
    ['an empty day', '54-bichanakandi__1-star-mosque'],
    ['11 days', Array.from({ length: 11 }, (_, i) => i + 1).join('_')],
    ['more characters than a link may hold', '1'.repeat(MAX_SHARE_LENGTH + 1)],
    ['two trip parameters, each valid alone', '54&trip=1'],
  ];
  for (const [what, value] of malformed) {
    await test.step(what, async () => {
      await page.goto(`/?trip=${value}`);
      await expect(page.getByRole('tab', { name: /^Plan/ })).toHaveAttribute('aria-selected', 'true');
      await expect(notice(page)).toContainText(INVALID);
      await expect(notice(page).getByRole('button')).toHaveText(['Dismiss']);
      await expect(notice(page).getByRole('listitem')).toHaveCount(0);
      await expect(stopsOf(page, 1)).toHaveText([/^Lalakhal/]); // the planner still shows this browser's trip
      if (value) expect(await page.locator('body').innerText()).not.toContain(decodeURIComponent(value));
      expect(await rawTrip(page)).toBe(saved);
    });
  }
  await notice(page).getByRole('button', { name: 'Dismiss' }).click();
  await expect(notice(page)).toHaveCount(0);
  expect(tripParam(page)).toEqual([]); // both of them
  expect(await rawTrip(page)).toBe(saved);
});

for (const theme of ['light', 'dark']) {
  test(`the shared trip notice and the copy field pass an axe scan (${theme} theme)`, async ({ page }) => {
    await page.addInitScript(t => localStorage.setItem('bd-discovery-passport:theme', t), theme);
    await rejectCopies(page);
    await saveLocalTrip(page, LOCAL_DAYS);
    await page.goto(`/?trip=${SHARED}`);
    await expect(notice(page).getByRole('listitem')).toHaveText(SHARED_LINES);
    expect(await scan(page)).toEqual([]);

    await page.goto('/?trip=54-gone-place');
    await expect(notice(page)).toContainText(INVALID);
    expect(await scan(page)).toEqual([]);

    await notice(page).getByRole('button', { name: 'Dismiss' }).click();
    await shareButton(page).click();
    await expect(planner(page).getByRole('textbox', { name: 'Trip link' })).toBeFocused();
    expect(await scan(page)).toEqual([]);
  });
}

test('on a phone with a passport page open, a share link carries only the trip, and Dismiss keeps the page in the address', async ({
  page,
  context,
  baseURL,
  isMobile,
}) => {
  test.skip(!isMobile, 'on a desktop an open passport page takes the planner’s column, so the planner cannot be used while one is open');
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  const saved = await saveLocalTrip(page, LOCAL_DAYS);
  await page.goto(`/?district=54&trip=${SHARED}`);
  await expect(page.getByRole('dialog', { name: 'Sylhet' })).toBeVisible();
  await expect(notice(page).getByRole('listitem')).toHaveText(SHARED_LINES);

  await shareButton(page).click();
  await expect(status(page)).toHaveText('Trip link copied.');
  const copied = new URL(await page.evaluate(() => navigator.clipboard.readText()));
  expect(`${copied.origin}${copied.pathname}`).toBe(`${baseURL}/`);
  expect([...copied.searchParams.keys()]).toEqual(['trip']); // no district, and one trip
  expect(copied.searchParams.get('trip')).toBe(LOCAL_LINK); // this browser's trip, not the link it came from

  await notice(page).getByRole('button', { name: 'Dismiss' }).click();
  await expect(notice(page)).toHaveCount(0);
  expect(new URL(page.url()).searchParams.get('district')).toBe('54');
  expect(tripParam(page)).toEqual([]);
  expect(await rawTrip(page)).toBe(saved);
});
