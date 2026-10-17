import AxeBuilder from '@axe-core/playwright';
import { test, expect } from './fixtures.js';

const tab = (page, name) => page.getByRole('tab', { name: new RegExp(`^${name}`) });
const progress = page => page.locator('.quiz-progress');
const root = page => page.locator('[data-mode]');

test('the mode switch is a tablist: Explore is selected and is its only tab stop', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('tablist', { name: 'Mode' }).getByRole('tab')).toHaveCount(3);
  for (const [name, selected] of [['Explore', true], ['Quiz', false], ['Plan', false]]) {
    await expect(tab(page, name)).toHaveAttribute('aria-selected', String(selected));
    await expect(tab(page, name)).toHaveAttribute('tabindex', selected ? '0' : '-1');
  }

  // one panel for all three modes, named by the selected tab; <main> stays a landmark
  const panel = page.getByRole('tabpanel');
  await expect(panel).toHaveAttribute('aria-labelledby', 'mode-tab-explore');
  await expect(panel.getByRole('region', { name: 'Map' })).toBeVisible();
  const panelId = await panel.getAttribute('id');
  for (const name of ['Explore', 'Quiz', 'Plan']) await expect(tab(page, name)).toHaveAttribute('aria-controls', panelId);
  await expect(page.getByRole('main')).toBeVisible();
  await expect(page.locator('main[role]')).toHaveCount(0);
});

test('arrow keys move focus without choosing a mode, so passing over Quiz starts no round', async ({ page }) => {
  await page.goto('/');
  await tab(page, 'Explore').focus();
  await page.keyboard.press('ArrowRight');
  await expect(tab(page, 'Quiz')).toBeFocused();
  await expect(root(page)).toHaveAttribute('data-mode', 'explore');
  await expect(progress(page)).toHaveCount(0);

  await page.keyboard.press('ArrowRight');
  await expect(tab(page, 'Plan')).toBeFocused();
  await expect(root(page)).toHaveAttribute('data-mode', 'explore');
  await expect(page.getByRole('heading', { name: /^Your trip/ })).toHaveCount(0);

  // the selected tab is still the one tab stop
  await expect(tab(page, 'Explore')).toHaveAttribute('aria-selected', 'true');
  await expect(tab(page, 'Explore')).toHaveAttribute('tabindex', '0');
  await expect(tab(page, 'Plan')).toHaveAttribute('tabindex', '-1');
});

test('arrow keys wrap around; Home and End go to the first and last tab', async ({ page }) => {
  await page.goto('/');
  await tab(page, 'Explore').focus();
  for (const [key, focused] of [
    ['ArrowLeft', 'Plan'],
    ['ArrowLeft', 'Quiz'],
    ['ArrowRight', 'Plan'],
    ['ArrowRight', 'Explore'],
    ['End', 'Plan'],
    ['Home', 'Explore'],
  ]) {
    await page.keyboard.press(key);
    await expect(tab(page, focused)).toBeFocused();
  }
  await expect(root(page)).toHaveAttribute('data-mode', 'explore');
});

test('Enter chooses the focused tab and focus stays on it', async ({ page }) => {
  await page.goto('/');
  await tab(page, 'Explore').focus();
  await page.keyboard.press('End');
  await page.keyboard.press('Enter');
  await expect(tab(page, 'Plan')).toHaveAttribute('aria-selected', 'true');
  await expect(tab(page, 'Plan')).toHaveAttribute('tabindex', '0');
  await expect(tab(page, 'Explore')).toHaveAttribute('aria-selected', 'false');
  await expect(tab(page, 'Explore')).toHaveAttribute('tabindex', '-1');
  await expect(page.getByRole('tabpanel')).toHaveAttribute('aria-labelledby', 'mode-tab-plan');
  await expect(page.getByRole('heading', { name: /^Your trip/ })).toBeVisible();
  await expect(tab(page, 'Plan')).toBeFocused();
});

test('Space chooses the focused tab and focus stays on it', async ({ page }) => {
  await page.goto('/');
  await tab(page, 'Explore').focus();
  await page.keyboard.press('ArrowRight');
  await page.keyboard.press('Space');
  await expect(tab(page, 'Quiz')).toHaveAttribute('aria-selected', 'true');
  await expect(progress(page)).toContainText('Question 1 of 10');
  await expect(tab(page, 'Quiz')).toBeFocused();
});

test('choosing the mode you are in does nothing: a round in progress is not restarted', async ({ page }) => {
  await page.goto('/');
  await tab(page, 'Quiz').click();
  // the prompt is announced as "Question 1 of 10. Find <name>."; find that district from the keyboard
  const name = (await page.getByRole('status').textContent()).match(/Find (.+)\.$/)[1];
  await page.getByRole('button', { name: `${name}, not yet discovered`, exact: true }).press('Enter');
  await expect(page.locator('.quiz-feedback')).toContainText('10 points.');
  await page.getByRole('button', { name: 'Next' }).click();
  await expect(progress(page)).toContainText('Question 2 of 10');

  await tab(page, 'Quiz').click();
  await expect(progress(page)).toContainText('Question 2 of 10');
  await tab(page, 'Quiz').press('Enter');
  await expect(progress(page)).toContainText('Question 2 of 10');
});

test('the indicator sits under the selected tab', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' }); // no slide to wait for
  await page.goto('/');
  const indicator = page.locator('.mode-tabs-indicator');
  for (const name of ['Explore', 'Quiz', 'Plan', 'Explore']) {
    await tab(page, name).click();
    const under = await indicator.boundingBox();
    const selected = await tab(page, name).boundingBox();
    for (const side of ['x', 'y', 'width', 'height']) expect(under[side], `${name} ${side}`).toBeCloseTo(selected[side], 0);
  }
});

test('reduced motion: the indicator and the tab text change instantly', async ({ page }) => {
  await page.goto('/');
  const durations = () =>
    page.evaluate(() => [...document.querySelectorAll('.mode-tab, .mode-tabs-indicator')].map(el => getComputedStyle(el).transitionDuration));

  await page.emulateMedia({ reducedMotion: 'no-preference' });
  expect(await durations()).toHaveLength(4);
  expect(await durations()).not.toContain('0s');

  await page.emulateMedia({ reducedMotion: 'reduce' });
  expect(new Set(await durations())).toEqual(new Set(['0s']));
});

test('the masthead with the mode tabs has no accessibility violations', async ({ page }) => {
  await page.goto('/');
  const { violations } = await new AxeBuilder({ page })
    .include('header')
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'])
    .analyze();
  expect(violations.map(v => `${v.id} (${v.impact}): ${v.nodes.map(n => n.target.join(' ')).slice(0, 3).join(', ')}`)).toEqual([]);
});
