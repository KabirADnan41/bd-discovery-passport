import { readFileSync } from 'node:fs';
import { test, expect, countText } from './fixtures.js';

const TRIP_KEY = 'bd-discovery-passport:trip:v1';
const EMPTY = 'Your trip is empty. Open a district and choose “Add to trip” on a place to start.';
const place = id => ({ kind: 'place', id });
const BICHANAKANDI = place('54-bichanakandi');
const LALAKHAL = place('54-lalakhal');
const SHAH_PARAN = place('54-shah-paran-dargah');
// Ten real places outside Sylhet: enough to fill a day or a whole trip with stops the planner keeps.
const OTHERS = Object.values(JSON.parse(readFileSync(new URL('../../src/data/places.json', import.meta.url), 'utf8')))
  .flat()
  .filter(p => !p.id.startsWith('54-'))
  .slice(0, 10)
  .map(p => place(p.id));

const rawTrip = page => page.evaluate(key => localStorage.getItem(key), TRIP_KEY);
const savedDays = async page => JSON.parse(await rawTrip(page))?.days;
// Opens `path` with this trip already saved, as if the user had built it on an earlier visit.
async function startWithTrip(page, days, path = '/') {
  const saved = JSON.stringify({ name: '', days });
  await page.evaluate(([key, value]) => localStorage.setItem(key, value), [TRIP_KEY, saved]);
  await page.goto(path);
  return saved;
}

const openPlanner = async page => {
  await page.locator('.mode-switch').getByText('Plan').click();
  await expect(page.getByRole('radio', { name: 'Plan' })).toBeChecked();
};
const planner = page => page.getByRole('region', { name: /^Your trip/ });
const heading = page => planner(page).getByRole('heading', { name: /^Your trip/ });
const dayOf = (page, n) => planner(page).locator('section', { has: page.getByRole('heading', { name: new RegExp(`^Day ${n}(?!\\d)`) }) });
const stopsOf = (page, n) => dayOf(page, n).getByRole('listitem');
const button = (page, name) => page.getByRole('button', { name, exact: true });
const status = page => page.getByRole('status');

test.beforeEach(async ({ page }) => {
  await page.goto('/');
});

test('an empty trip says how to start, has no Directions link and saves nothing', async ({ page }) => {
  await openPlanner(page);
  await expect(planner(page).getByText(EMPTY)).toBeVisible();
  await expect(planner(page).getByRole('link', { name: /^Directions/ })).toHaveCount(0);
  expect(await rawTrip(page)).toBeNull();
});

test('a saved trip lists its days in order, each with Google Maps directions in a new tab', async ({ page }) => {
  await startWithTrip(page, [[BICHANAKANDI, LALAKHAL], [SHAH_PARAN]]);
  await openPlanner(page);
  await expect(stopsOf(page, 1)).toHaveText([/^Bichanakandi/, /^Lalakhal/]);
  await expect(stopsOf(page, 2)).toHaveText([/^Shah Paran Dargah/]);
  await expect(stopsOf(page, 1).first()).toContainText('বিছনাকান্দি');
  await expect(stopsOf(page, 1).first()).toContainText('Sylhet');

  const directions = n => dayOf(page, n).getByRole('link', { name: `Directions for day ${n} in Google Maps (opens in a new tab)`, exact: true });
  for (const n of [1, 2]) {
    await expect(directions(n)).toHaveAttribute('href', /^https:\/\/www\.google\.com\/maps\/dir\/\?api=1&/);
    await expect(directions(n)).toHaveAttribute('target', '_blank');
    await expect(directions(n)).toHaveAttribute('rel', 'noopener noreferrer');
  }
  // day 1 runs from its first stop to its last; day 2's one stop is a destination only
  const day1 = new URL(await directions(1).getAttribute('href')).searchParams;
  expect(day1.get('origin')).toMatch(/^Bichanakandi, .+, Bangladesh$/);
  expect(day1.get('destination')).toMatch(/^Lalakhal, .+, Bangladesh$/);
  const day2 = new URL(await directions(2).getAttribute('href')).searchParams;
  expect(day2.has('origin')).toBe(false);
  expect(day2.get('destination')).toMatch(/^Shah Paran Dargah, /);
});

test('Move down and Move up reorder a day, keep focus on the moved stop, and the order is saved', async ({ page }) => {
  await startWithTrip(page, [[BICHANAKANDI, LALAKHAL, SHAH_PARAN]]);
  await openPlanner(page);
  await button(page, 'Move down: Bichanakandi').click();
  await expect(stopsOf(page, 1)).toHaveText([/^Lalakhal/, /^Bichanakandi/, /^Shah Paran Dargah/]);
  await expect(status(page)).toHaveText('Moved Bichanakandi to day 1, stop 2.');
  await expect(button(page, 'Move down: Bichanakandi')).toBeFocused();

  await button(page, 'Move up: Shah Paran Dargah').click();
  await expect(stopsOf(page, 1)).toHaveText([/^Lalakhal/, /^Shah Paran Dargah/, /^Bichanakandi/]);
  await expect(button(page, 'Move up: Shah Paran Dargah')).toBeFocused();

  await page.reload(); // the mode is not in the URL, so the page opens in explore mode
  await openPlanner(page);
  await expect(stopsOf(page, 1)).toHaveText([/^Lalakhal/, /^Shah Paran Dargah/, /^Bichanakandi/]);
});

test('Move down on the last stop of a day starts the next day; Move up on a first stop ends the day before', async ({ page }) => {
  await startWithTrip(page, [[BICHANAKANDI, LALAKHAL], [SHAH_PARAN]]);
  await openPlanner(page);
  await button(page, 'Move down: Lalakhal').click();
  await expect(stopsOf(page, 1)).toHaveText([/^Bichanakandi/]);
  await expect(stopsOf(page, 2)).toHaveText([/^Lalakhal/, /^Shah Paran Dargah/]);
  await expect(status(page)).toHaveText('Moved Lalakhal to day 2, stop 1.');
  await expect(button(page, 'Move down: Lalakhal')).toBeFocused();

  await page.reload();
  await openPlanner(page);
  await expect(stopsOf(page, 2)).toHaveText([/^Lalakhal/, /^Shah Paran Dargah/]);

  await button(page, 'Move up: Lalakhal').click();
  await expect(stopsOf(page, 1)).toHaveText([/^Bichanakandi/, /^Lalakhal/]);
  await expect(status(page)).toHaveText('Moved Lalakhal to day 1, stop 2.');
  await expect(button(page, 'Move up: Lalakhal')).toBeFocused();
  expect(await savedDays(page)).toEqual([[BICHANAKANDI, LALAKHAL], [SHAH_PARAN]]);
});

test('Remove takes a stop out for good, and its place page offers "Add to trip" again', async ({ page }) => {
  await startWithTrip(page, [[BICHANAKANDI, LALAKHAL]]);
  await openPlanner(page);
  await button(page, 'Remove: Bichanakandi').click();
  await expect(stopsOf(page, 1)).toHaveText([/^Lalakhal/]);
  await expect(status(page)).toHaveText('Removed Bichanakandi from your trip.');
  await expect(button(page, 'Remove: Lalakhal')).toBeFocused(); // the next stop's Remove button

  await page.reload();
  await openPlanner(page);
  await expect(stopsOf(page, 1)).toHaveText([/^Lalakhal/]);

  // plan mode opens passport pages like explore mode does
  await page.locator('#district-index').getByRole('button', { name: /^Sylhet/ }).click();
  const card = page.getByRole('dialog', { name: 'Sylhet' });
  await expect(card.getByRole('button', { name: 'Add to trip: Bichanakandi', exact: true })).toBeVisible();
  await expect(card.getByRole('button', { name: 'In your trip: Lalakhal', exact: true })).toBeVisible();
  await card.getByRole('button', { name: 'Close' }).click();
  await expect(planner(page)).toBeVisible();
});

test('after Remove, focus goes to the previous stop when there is no next one, then to the heading', async ({ page }) => {
  await startWithTrip(page, [[BICHANAKANDI], [LALAKHAL]]);
  await openPlanner(page);
  await button(page, 'Remove: Lalakhal').click();
  await expect(button(page, 'Remove: Bichanakandi')).toBeFocused();
  await button(page, 'Remove: Bichanakandi').click();
  await expect(planner(page).getByText(EMPTY)).toBeVisible();
  await expect(heading(page)).toBeFocused();
  expect(await rawTrip(page)).toBeNull(); // an emptied trip is forgotten, not saved as empty days
});

test('an emptied trip starts afresh: the next stop lands on a day 1 that is shown', async ({ page }) => {
  await startWithTrip(page, [[BICHANAKANDI], [LALAKHAL]]);
  await openPlanner(page);
  await button(page, 'Remove: Lalakhal').click();
  await expect(button(page, 'Remove: Bichanakandi')).toBeFocused();
  await button(page, 'Remove: Bichanakandi').click();
  await expect(planner(page).getByText(EMPTY)).toBeVisible();

  await page.locator('#district-index').getByRole('button', { name: /^Sylhet/ }).click();
  const card = page.getByRole('dialog', { name: 'Sylhet' });
  await card.getByRole('button', { name: 'Add to trip: Bichanakandi', exact: true }).click();
  await expect(card.getByRole('button', { name: 'In your trip: Bichanakandi', exact: true })).toBeVisible();
  await card.getByRole('button', { name: 'Close' }).click();
  await expect(planner(page).getByRole('heading', { name: /^Day / })).toHaveText([/^Day 1(?!\d)/]); // exactly one day
  await expect(stopsOf(page, 1)).toHaveText([/^Bichanakandi/]);
  expect(await savedDays(page)).toEqual([[BICHANAKANDI]]);
});

test('Add a day adds an empty day, and Remove day takes an empty day away', async ({ page }) => {
  await startWithTrip(page, [[BICHANAKANDI]]);
  await openPlanner(page);
  await expect(planner(page).getByRole('button', { name: /^Remove day/ })).toHaveCount(0); // the only day stays
  await button(page, 'Add a day').click();
  await expect(dayOf(page, 2)).toBeVisible();
  await expect(status(page)).toHaveText('Added day 2.');
  expect(await savedDays(page)).toEqual([[BICHANAKANDI], []]);
  await expect(dayOf(page, 1).getByRole('button', { name: /^Remove day/ })).toHaveCount(0); // a day with stops has none
  await expect(dayOf(page, 2).getByRole('link')).toHaveCount(0); // an empty day has no Directions

  await button(page, 'Remove day 2').click();
  await expect(dayOf(page, 2)).toHaveCount(0);
  await expect(status(page)).toHaveText('Removed day 2.');
  await expect(heading(page)).toBeFocused(); // the removed day's button is gone, so focus goes to the heading
  expect(await savedDays(page)).toEqual([[BICHANAKANDI]]);
});

test('Clear trip asks first; keeping changes nothing, clearing empties the trip and forgets it', async ({ page }) => {
  const saved = await startWithTrip(page, [[BICHANAKANDI], [LALAKHAL]]);
  await openPlanner(page);
  const dialog = page.getByRole('dialog', { name: 'Clear your trip?' });
  await planner(page).getByRole('button', { name: 'Clear trip' }).click();
  await expect(dialog).toContainText('This removes every stop and day from this browser. It cannot be undone.');
  await dialog.getByRole('button', { name: 'Keep my trip' }).click();
  await expect(dialog).toBeHidden();
  expect(await rawTrip(page)).toBe(saved);
  await expect(stopsOf(page, 2)).toHaveText([/^Lalakhal/]);
  await expect(planner(page).getByRole('button', { name: 'Clear trip' })).toBeFocused(); // back where it was

  await planner(page).getByRole('button', { name: 'Clear trip' }).click();
  await dialog.getByRole('button', { name: 'Clear trip' }).click();
  await expect(planner(page).getByText(EMPTY)).toBeVisible();
  await expect(status(page)).toHaveText('Trip cleared.');
  expect(await rawTrip(page)).toBeNull();
  await expect(heading(page)).toBeFocused();
});

test('one dialog asks both questions: Clear trip, then Reset passport, each with its own words and action', async ({ page }) => {
  const saved = await startWithTrip(page, [[BICHANAKANDI], [LALAKHAL]]);
  await page.locator('[data-district-id="64"]').click(); // a stamp for the reset to clear
  await page.keyboard.press('Escape');
  expect(await countText(page)).toBe('1');
  await openPlanner(page);
  await planner(page).getByRole('button', { name: 'Clear trip' }).click();
  const clearDialog = page.getByRole('dialog', { name: 'Clear your trip?' });
  await clearDialog.getByRole('button', { name: 'Keep my trip' }).click();
  await expect(clearDialog).toBeHidden();

  await page.getByRole('button', { name: 'Menu' }).click();
  await page.getByRole('button', { name: 'Reset passport' }).click();
  const resetDialog = page.getByRole('dialog', { name: 'Reset your passport?' });
  await expect(resetDialog.getByRole('button', { name: 'Keep my stamps' })).toBeVisible();
  await expect(resetDialog).toContainText('This removes all 1 stamps from this browser. It cannot be undone.');
  await resetDialog.getByRole('button', { name: 'Clear all stamps' }).click();
  await expect.poll(() => countText(page)).toBe('0');
  expect(await rawTrip(page)).toBe(saved); // the reset answered for the passport, not the trip
  await expect(stopsOf(page, 2)).toHaveText([/^Lalakhal/]);
});

test('a saved place that no longer exists is dropped once the planner loads, and not before', async ({ page }) => {
  const gone = place('54-gone-place');
  await startWithTrip(page, [[BICHANAKANDI, gone]], '/?district=54');
  // the passport page loads the places too, but only the planner prunes
  const card = page.getByRole('dialog', { name: 'Sylhet' });
  await expect(card.getByRole('button', { name: 'In your trip: Bichanakandi', exact: true })).toBeVisible();
  expect(await savedDays(page)).toEqual([[BICHANAKANDI, gone]]);

  await openPlanner(page);
  await expect(stopsOf(page, 1)).toHaveText([/^Bichanakandi/]);
  await expect.poll(() => savedDays(page)).toEqual([[BICHANAKANDI]]);
});

test('moves that cannot happen are aria-disabled, stay focusable and change nothing', async ({ page }) => {
  const saved = await startWithTrip(page, [[BICHANAKANDI], [LALAKHAL]]);
  await openPlanner(page);
  const firstUp = button(page, 'Move up: Bichanakandi');
  const lastDown = button(page, 'Move down: Lalakhal');
  await expect(firstUp).toHaveAttribute('aria-disabled', 'true');
  await expect(lastDown).toHaveAttribute('aria-disabled', 'true');
  await expect(firstUp).not.toHaveAttribute('disabled');
  await expect(button(page, 'Move down: Bichanakandi')).not.toHaveAttribute('aria-disabled'); // into day 2 is fine
  await firstUp.click({ force: true }); // Playwright treats aria-disabled as unclickable; a user can still press it
  await lastDown.click({ force: true });
  expect(await rawTrip(page)).toBe(saved);
  await expect(stopsOf(page, 1)).toHaveText([/^Bichanakandi/]);
});

test('a stop cannot move into a full day, and a trip of ten days cannot add another', async ({ page }) => {
  await startWithTrip(page, [OTHERS, [BICHANAKANDI]]);
  await openPlanner(page);
  await expect(button(page, 'Move up: Bichanakandi')).toHaveAttribute('aria-disabled', 'true');
  await expect(button(page, 'Add a day')).not.toHaveAttribute('aria-disabled');

  await startWithTrip(page, OTHERS.map(stop => [stop]));
  await openPlanner(page);
  await expect(dayOf(page, 10)).toBeVisible();
  await expect(button(page, 'Add a day')).toHaveAttribute('aria-disabled', 'true');
});

test('quiz and plan switch like quiz and explore: plan ends a round, quiz starts one', async ({ page }) => {
  await page.locator('.mode-switch').getByText('Quiz').click();
  await expect(page.locator('.quiz-progress')).toContainText('Question 1 of 10');
  await openPlanner(page);
  await expect(page.locator('.quiz')).toHaveCount(0);
  await expect(heading(page)).toBeVisible();
  await page.locator('.mode-switch').getByText('Quiz').click();
  await expect(page.locator('.quiz-progress')).toContainText('Question 1 of 10');
  await expect(planner(page)).toHaveCount(0);
});

test('switching to Plan announces it, as switching to Explore does', async ({ page }) => {
  await openPlanner(page);
  await expect(status(page)).toHaveText('Plan mode.');
});

test('no horizontal overflow in plan mode at the required widths', async ({ page, isMobile }) => {
  test.skip(isMobile, 'widths are set explicitly');
  await startWithTrip(page, [[BICHANAKANDI, place('54-khadim-nagar-national-park')], []]);
  await openPlanner(page);
  await expect(stopsOf(page, 1)).toHaveCount(2);
  for (const width of [375, 430, 768, 1024, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow, `overflow at ${width}px`).toBeLessThanOrEqual(0);
  }
});
