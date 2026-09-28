import { execSync } from 'node:child_process';
import { test, expect, countText } from './fixtures.js';

// Accounts touch the shared local D1 and its rate limits, so they run once (desktop) and in order.
test.describe.configure({ mode: 'serial' });

const user = `e2e_${Date.now().toString(36)}`;
const password = 'meghna-delta-2026';
const authDialog = page => page.locator('dialog[open]');

test.beforeAll(() => {
  execSync('npm run db:reset-limits:local', { stdio: 'ignore' });
});

test.skip(({ isMobile }) => isMobile, 'account flows run once, on desktop');

test('sign up needs the terms box, then brings guest stamps along', async ({ page }) => {
  await page.goto('/');
  await page.locator('[data-district-id="1"]').click();
  await page.keyboard.press('Escape');

  await page.getByRole('button', { name: 'Menu' }).click();
  await page.getByRole('button', { name: 'Create account' }).click();
  const dialog = authDialog(page);
  await dialog.getByLabel('Username').fill(user);
  await dialog.getByLabel('Password', { exact: true }).fill(password);
  await dialog.getByRole('button', { name: 'Create account' }).click();
  await expect(dialog.getByRole('alert')).toContainText('agree to the terms');
  await expect(dialog.getByRole('checkbox', { name: /I agree to the terms of use/ })).toBeFocused();

  await expect(dialog.getByRole('checkbox', { name: /Add the 1 stamp/ })).toBeChecked(); // sign-up: merge by default
  await dialog.getByRole('checkbox', { name: /I agree to the terms of use/ }).check();
  await dialog.getByRole('button', { name: 'Create account' }).click();
  await expect(page.getByRole('button', { name: user })).toBeVisible({ timeout: 15_000 });

  expect(await page.evaluate(() => localStorage.getItem('bd-discovery-passport:v1'))).toBeNull(); // guest copy cleared
  await page.locator('[data-district-id="54"]').click();
  await expect.poll(() => page.evaluate(() => fetch('/api/me').then(r => r.json()).then(j => j.discovered))).toEqual(['1', '54']);
});

test('sign out gives an empty guest passport; sign in restores the account', async ({ page }) => {
  await page.goto('/');
  // fresh context: sign in first (cookies are per test)
  await page.getByRole('button', { name: 'Menu' }).click();
  await page.getByRole('button', { name: 'Sign in' }).click();
  const dialog = authDialog(page);
  await expect(dialog.getByRole('checkbox', { name: /Add the/ })).toHaveCount(0); // no guest stamps in this context
  await dialog.getByLabel('Username').fill(user.toUpperCase()); // usernames are case-insensitive
  await dialog.getByLabel('Password', { exact: true }).fill('not-the-password');
  await dialog.getByRole('button', { name: 'Sign in' }).click();
  await expect(dialog.getByRole('alert')).toContainText('Username or password is incorrect.');
  await dialog.getByLabel('Password', { exact: true }).fill(password);
  await dialog.getByRole('button', { name: 'Sign in' }).click();
  await expect(page.getByRole('button', { name: user })).toBeVisible({ timeout: 15_000 });
  expect(await countText(page)).toBe('2');

  await page.getByRole('button', { name: user }).click();
  await page.getByRole('button', { name: 'Sign out' }).click();
  await expect(page.getByRole('button', { name: 'Menu' })).toBeVisible();
  expect(await countText(page)).toBe('0');
});

test('sign-in does not merge a shared device\'s guest stamps unless asked', async ({ page }) => {
  await page.goto('/');
  await page.locator('[data-district-id="64"]').click(); // someone else's guest stamp on this device
  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: 'Menu' }).click();
  await page.getByRole('button', { name: 'Sign in' }).click();
  const dialog = authDialog(page);
  await expect(dialog.getByRole('checkbox', { name: /Add the 1 stamp/ })).not.toBeChecked();
  await dialog.getByLabel('Username').fill(user);
  await dialog.getByLabel('Password', { exact: true }).fill(password);
  await dialog.getByRole('button', { name: 'Sign in' }).click();
  await expect(page.getByRole('button', { name: user })).toBeVisible({ timeout: 15_000 });
  expect(await countText(page)).toBe('2'); // 1 and 54 only; Satkhira stayed with the guest
  expect(await page.evaluate(() => localStorage.getItem('bd-discovery-passport:v1'))).toContain('64');
});

test('deleting the account needs the password and removes it', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Menu' }).click();
  await page.getByRole('button', { name: 'Sign in' }).click();
  const signIn = authDialog(page);
  await signIn.getByLabel('Username').fill(user);
  await signIn.getByLabel('Password', { exact: true }).fill(password);
  await signIn.getByRole('button', { name: 'Sign in' }).click();
  await expect(page.getByRole('button', { name: user })).toBeVisible({ timeout: 15_000 });

  await page.getByRole('button', { name: user }).click();
  await page.getByRole('button', { name: 'Delete account' }).click();
  const dialog = authDialog(page);
  await dialog.getByLabel('Password').fill('wrong-password-x');
  await dialog.getByRole('button', { name: 'Delete account' }).click();
  await expect(dialog.getByRole('alert')).toHaveText('Password is incorrect.');
  await dialog.getByLabel('Password').fill(password);
  await dialog.getByRole('button', { name: 'Delete account' }).click();
  await expect(page.getByRole('button', { name: 'Menu' })).toBeVisible({ timeout: 15_000 });
  expect(await page.evaluate(() => fetch('/api/me').then(r => r.json()))).toEqual({ signedIn: false });
});
