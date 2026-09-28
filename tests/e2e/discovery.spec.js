import { test, expect, countText } from './fixtures.js';

const openCard = (page, name) => page.getByRole('dialog', { name });
// The gazetteer entry for a district (the map path has the same accessible name prefix).
const indexEntry = (page, name) => page.locator('#district-index').getByRole('button', { name: new RegExp(`^${name}`) });

test.beforeEach(async ({ page }) => {
  await page.goto('/');
});

test('loads the atlas with all 64 districts and an empty passport', async ({ page }) => {
  await expect(page.locator('[data-district-id]')).toHaveCount(64);
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Bangladesh Discovery Passport');
  expect(await countText(page)).toBe('0');
  await expect(page.locator('[data-district-id][data-state="discovered"]')).toHaveCount(0);
});

test('hovering a district shows its bilingual name', async ({ page, isMobile }) => {
  test.skip(isMobile, 'hover tooltips are for mouse pointers only');
  await page.locator('[data-district-id="17"]').hover();
  const tooltip = page.locator('.map-tooltip');
  await expect(tooltip).toContainText('Tangail');
  await expect(tooltip).toContainText('Not yet discovered');
});

test('first discovery stamps once; reopening does not count again', async ({ page }) => {
  const sylhet = page.locator('[data-district-id="54"]');
  await sylhet.click();
  await expect(sylhet).toHaveAttribute('data-state', 'discovered');
  const card = openCard(page, 'Sylhet');
  await expect(card).toBeVisible();
  await expect(card.getByRole('img', { name: /Passport stamp: Sylhet/ })).toBeVisible();
  await expect(card.getByText('New stamp')).toBeVisible();
  await expect(card.getByText('Shah Jalal Dargah', { exact: true })).toBeVisible();
  expect(await countText(page)).toBe('1');

  await card.getByRole('button', { name: 'Close' }).click();
  await expect(page.locator('.sheet')).toHaveCount(0);

  await sylhet.click();
  await expect(openCard(page, 'Sylhet')).toBeVisible();
  await expect(page.getByText('New stamp')).toHaveCount(0);
  expect(await countText(page)).toBe('1');
});

test('a district without checked content never shows a blank card', async ({ page }) => {
  await indexEntry(page, 'Nilphamari').click();
  const card = openCard(page, 'Nilphamari');
  await expect(card.getByText('More discoveries coming soon.')).toBeVisible();
  await expect(card.getByText('Neighbouring districts')).toBeVisible();
  // neighbours are real, clickable districts from the boundary topology
  await card.getByRole('button', { name: /^Rangpur/ }).click();
  await expect(openCard(page, 'Rangpur')).toBeVisible();
  expect(await countText(page)).toBe('2');
});

test('stamps persist across reloads (guest)', async ({ page }) => {
  await indexEntry(page, 'Dhaka').click();
  await page.keyboard.press('Escape');
  await indexEntry(page, "Cox's Bazar").click();
  await page.reload();
  expect(await countText(page)).toBe('2');
  await expect(page.locator('[data-district-id="1"]')).toHaveAttribute('data-state', 'discovered');
  await expect(page.locator('[data-district-id="45"]')).toHaveAttribute('data-state', 'discovered');
});

test('reset needs deliberate confirmation', async ({ page }) => {
  await page.locator('[data-district-id="64"]').click();
  await page.keyboard.press('Escape');
  const reset = async () => {
    await page.getByRole('button', { name: 'Menu' }).click();
    await page.getByRole('button', { name: 'Reset passport' }).click();
  };
  await reset();
  await page.getByRole('dialog', { name: 'Reset your passport?' }).getByRole('button', { name: 'Keep my stamps' }).click();
  expect(await countText(page)).toBe('1');
  await reset();
  await page.getByRole('dialog', { name: 'Reset your passport?' }).getByRole('button', { name: 'Clear all stamps' }).click();
  expect(await countText(page)).toBe('0');
});

test('keyboard: one tab stop into the map, arrows move, Enter discovers, Escape returns focus', async ({ page, isMobile }) => {
  test.skip(isMobile, 'keyboard walkthrough runs on desktop');
  for (let i = 0; i < 6; i++) {
    await page.keyboard.press('Tab');
    if (await page.evaluate(() => document.activeElement?.hasAttribute('data-district-id'))) break;
  }
  const first = await page.evaluate(() => document.activeElement?.dataset.districtId);
  expect(first).toBe('1'); // Dhaka is the entry point
  await page.keyboard.press('ArrowUp');
  const moved = await page.evaluate(() => document.activeElement?.dataset.districtId);
  expect(moved).not.toBe('1');
  await page.keyboard.press('Enter');
  await expect(page.locator('#passport-title')).toBeFocused();
  expect(await countText(page)).toBe('1');
  await page.keyboard.press('Escape');
  await expect(page.locator(`#district-${moved}`)).toBeFocused();
  // Tab leaves the map (a single tab stop, not 64)
  await page.keyboard.press('Tab');
  expect(await page.evaluate(() => document.activeElement?.hasAttribute('data-district-id'))).toBe(false);
});

test('deep link opens a district and the URL follows the open page', async ({ page }) => {
  await page.goto('/?district=45');
  await expect(openCard(page, "Cox's Bazar")).toBeVisible();
  await expect(page).toHaveTitle(/^Cox's Bazar \| /);
  await openCard(page, "Cox's Bazar").getByRole('button', { name: 'Close' }).click();
  await expect(page).not.toHaveURL(/district=/);
  await indexEntry(page, 'Sylhet').click();
  await expect(page).toHaveURL(/district=54/);
});

test('no horizontal overflow at the required widths', async ({ page, isMobile }) => {
  test.skip(isMobile, 'widths are set explicitly');
  for (const width of [375, 430, 768, 1024, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow, `overflow at ${width}px`).toBeLessThanOrEqual(0);
  }
});

test('policy pages are reachable from the footer and render without JavaScript', async ({ browser }) => {
  const ctx = await browser.newContext({ javaScriptEnabled: false });
  const page = await ctx.newPage();
  await page.goto('/privacy/');
  await expect(page.getByRole('heading', { level: 1, name: 'Privacy notice' })).toBeVisible();
  await expect(page.getByText('__Host-bdp_session')).toBeVisible();
  await page.getByRole('link', { name: 'Terms of use' }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'Terms of use' })).toBeVisible();
  await expect(page.getByText('not an official or authoritative depiction')).toBeVisible();
  await ctx.close();
});
