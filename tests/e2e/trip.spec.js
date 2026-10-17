import { test, expect } from './fixtures.js';

const TRIP_KEY = 'bd-discovery-passport:trip:v1';
const indexEntry = (page, name) => page.locator('#district-index').getByRole('button', { name: new RegExp(`^${name}`) });
// A section of Sylhet's open passport page, found by its heading.
const sectionOf = (page, title) =>
  page.getByRole('dialog', { name: 'Sylhet' }).locator('section', { has: page.getByRole('heading', { name: new RegExp(`^${title}`) }) });
const addButton = (page, place) => sectionOf(page, 'Places to go').getByRole('button', { name: `Add to trip: ${place}`, exact: true });
const inTripButton = (page, place) => sectionOf(page, 'Places to go').getByRole('button', { name: `In your trip: ${place}`, exact: true });
const savedTrip = page => page.evaluate(key => localStorage.getItem(key), TRIP_KEY);

// A full day is 10 stops and a trip has at most 10 days (MAX_STOPS_PER_DAY and MAX_DAYS in src/lib/trip.js).
// The ids are valid stops that match no real place, so Sylhet's places stay free to add.
const fullDay = day => Array.from({ length: 10 }, (_, i) => ({ kind: 'place', id: `1-seed-${day * 10 + i}` }));
// Reloads with this trip already saved, as if the user had built it on an earlier visit.
async function startWithTrip(page, days) {
  const saved = JSON.stringify({ name: '', days });
  await page.evaluate(([key, value]) => localStorage.setItem(key, value), [TRIP_KEY, saved]);
  await page.reload();
  return saved;
}

test.beforeEach(async ({ page }) => {
  await page.goto('/');
});

test('Add to trip becomes "In your trip" and is still there after a reload', async ({ page }) => {
  await indexEntry(page, 'Sylhet').click();
  await addButton(page, 'Bichanakandi').click();
  await expect(inTripButton(page, 'Bichanakandi')).toHaveAttribute('aria-disabled', 'true');
  await expect(inTripButton(page, 'Bichanakandi')).not.toHaveAttribute('disabled'); // it stays focusable

  await page.reload(); // the URL names the district, so its card opens again
  await expect(inTripButton(page, 'Bichanakandi')).toHaveAttribute('aria-disabled', 'true');
  await expect(addButton(page, 'Lalakhal')).toBeVisible(); // the other places are still open to add
});

test('nothing is saved until the first stop is added, then it is saved and announced', async ({ page }) => {
  expect(await savedTrip(page)).toBeNull();
  await indexEntry(page, 'Sylhet').click();
  await expect(addButton(page, 'Bichanakandi')).toBeVisible(); // the places have loaded
  expect(await savedTrip(page)).toBeNull();

  await addButton(page, 'Bichanakandi').click();
  await expect(inTripButton(page, 'Bichanakandi')).toBeVisible();
  expect(JSON.parse(await savedTrip(page)).days).toEqual([[{ kind: 'place', id: '54-bichanakandi' }]]);
  await expect(page.getByRole('status')).toHaveText('Added Bichanakandi to your trip.');
});

test('clicking "In your trip" changes nothing', async ({ page }) => {
  await indexEntry(page, 'Sylhet').click();
  await addButton(page, 'Bichanakandi').click();
  await expect(inTripButton(page, 'Bichanakandi')).toHaveAttribute('aria-disabled', 'true');
  const saved = await savedTrip(page);

  await inTripButton(page, 'Bichanakandi').click({ force: true }); // Playwright treats aria-disabled as unclickable; a user can still press it
  expect(await savedTrip(page)).toBe(saved);
});

test('a full day starts a new day for the next stop', async ({ page }) => {
  await startWithTrip(page, [fullDay(0)]);
  await indexEntry(page, 'Sylhet').click();
  await addButton(page, 'Bichanakandi').click();
  await expect(inTripButton(page, 'Bichanakandi')).toBeVisible();
  expect(JSON.parse(await savedTrip(page)).days.map(day => day.length)).toEqual([10, 1]);
});

test('a trip with every day full says so and is left as it was', async ({ page }) => {
  const saved = await startWithTrip(page, Array.from({ length: 10 }, (_, day) => fullDay(day)));
  await indexEntry(page, 'Sylhet').click();
  await addButton(page, 'Bichanakandi').click();
  await expect(page.getByRole('status')).toHaveText('Your trip is full.');
  await expect(addButton(page, 'Bichanakandi')).toBeVisible(); // still not in the trip
  expect(await savedTrip(page)).toBe(saved);
});

test('landmarks and culture items have no Add to trip button', async ({ page }) => {
  await indexEntry(page, 'Sylhet').click();
  // the places do have it, so the checks below do not pass just because nothing rendered
  await expect(addButton(page, 'Bichanakandi')).toBeVisible();
  const landmarks = sectionOf(page, 'Landmarks');
  await expect(landmarks.getByText('Shah Jalal Dargah', { exact: true })).toBeVisible();
  await expect(landmarks.getByRole('button', { name: /^Add to trip/ })).toHaveCount(0);

  const inPlaces = await sectionOf(page, 'Places to go').getByRole('button', { name: /^Add to trip/ }).count();
  await expect(page.getByRole('dialog', { name: 'Sylhet' }).getByRole('button', { name: /^Add to trip/ })).toHaveCount(inPlaces);
});
