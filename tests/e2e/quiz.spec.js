import { readFileSync } from 'node:fs';
import { test, expect, countText } from './fixtures.js';

const { districts } = JSON.parse(readFileSync(new URL('../../src/generated/districtPaths.generated.json', import.meta.url), 'utf8'));

// The district the prompt asks for, read from the visible "Find <name> <Bengali name>" heading.
const promptedDistrict = async page => {
  const text = (await page.locator('#quiz-title').innerText()).replace(/\s+/g, ' ').trim();
  return districts.find(d => text === `Find ${d.name} ${d.bn}`);
};

// Click at the district's label point, which lies inside the shape even when the shape is concave or tiny.
const clickDistrict = async (page, d) => {
  const path = page.locator(`#district-${d.id}`);
  await path.scrollIntoViewIfNeeded();
  const box = await path.boundingBox();
  const scale = box.width / (d.bbox[2] - d.bbox[0]);
  await path.click({ position: { x: (d.label[0] - d.bbox[0]) * scale, y: (d.label[1] - d.bbox[1]) * scale } });
};

const feedback = page => page.locator('.quiz-feedback');
const next = page => page.getByRole('button', { name: 'Next' });

test('quiz: find districts, get a hint after a miss, finish with a summary and no stamps', async ({ page, isMobile }) => {
  await page.goto('/');
  await page.locator('.mode-switch').getByText('Quiz').click();
  await expect(page.getByRole('radio', { name: 'Quiz' })).toBeChecked();
  await expect(page.locator('#district-index')).toHaveCount(0);

  // 1: a find on the first try scores 10 and marks the district
  const first = await promptedDistrict(page);
  expect(first, 'prompt names a real district').toBeTruthy();
  await expect(page.locator('.quiz-progress')).toContainText('Question 1 of 10');
  if (!isMobile) {
    await page.locator('#district-17').hover();
    await expect(page.locator('.map-tooltip')).toHaveCount(0); // no names on the map in quiz mode
  }
  await clickDistrict(page, first);
  await expect(feedback(page)).toHaveText(`Correct, that is ${first.name}. 10 points.`);
  await expect(page.locator(`#district-${first.id}`)).toHaveAttribute('data-quiz', 'correct');
  await expect(page.getByRole('dialog')).toHaveCount(0); // no passport page
  await next(page).click();
  await expect(page.locator(`#district-${first.id}`)).toBeFocused(); // focus returns to the map
  await expect(page.locator('[data-quiz]')).toHaveCount(0);

  // 2: a keyboard guess on the wrong district (the focused one) gives a hint, then a find scores 5
  const second = await promptedDistrict(page);
  await page.keyboard.press('Enter');
  await expect(feedback(page)).toHaveText(
    new RegExp(`^That is ${first.name}\\. ${second.name} is \\d+0 km (north|north-east|east|south-east|south|south-west|west|north-west) of there\\.$`),
  );
  await expect(page.locator(`#district-${first.id}`)).toHaveAttribute('data-quiz', 'wrong');
  await clickDistrict(page, second);
  await expect(feedback(page)).toHaveText(`Correct, that is ${second.name}. 5 points.`);
  await next(page).click();

  // 3 to 10: find each one first time
  for (let q = 3; q <= 10; q++) {
    await expect(page.locator('.quiz-progress')).toContainText(`Question ${q} of 10`);
    await clickDistrict(page, await promptedDistrict(page));
    await expect(feedback(page)).toContainText('10 points.');
    await next(page).click();
  }

  // summary: score, best score, the 10 districts with points, and the way out
  const heading = page.getByRole('heading', { name: 'You scored 95 out of 100' });
  await expect(heading).toBeFocused();
  await expect(page.getByText('Best score: 95 out of 100')).toBeVisible();
  const rows = page.locator('.quiz-results li');
  await expect(rows).toHaveCount(10);
  await expect(rows.nth(1)).toContainText(second.name);
  await expect(rows.nth(1)).toContainText('5 points');
  expect(await page.evaluate(() => localStorage.getItem('bd-discovery-passport:quiz-best'))).toBe('95');

  // guesses never stamp the passport
  expect(await countText(page)).toBe('0');
  await expect(page.locator('[data-state="discovered"][data-district-id]')).toHaveCount(0);

  await page.getByRole('button', { name: 'Clear best score' }).click();
  await expect(page.getByText('No best score saved.')).toBeVisible();
  expect(await page.evaluate(() => localStorage.getItem('bd-discovery-passport:quiz-best'))).toBeNull();

  await page.getByRole('button', { name: 'Back to explore' }).click();
  await expect(page.getByRole('radio', { name: 'Explore' })).toBeChecked();
  await expect(page.locator('#district-index')).toBeVisible();
});

test('starting a quiz closes an open passport page; switching to explore abandons the round', async ({ page }) => {
  await page.goto('/?district=54'); // an open passport page closes when the quiz starts
  await page.locator('.mode-switch').getByText('Quiz').click();
  await expect(page.getByRole('dialog', { name: 'Sylhet' })).toHaveCount(0);
  await expect(page.locator('.quiz-progress')).toContainText('Question 1 of 10');
  await page.locator('.mode-switch').getByText('Explore').click();
  await expect(page.locator('.quiz')).toHaveCount(0);
  await page.locator('.mode-switch').getByText('Quiz').click();
  await expect(page.locator('.quiz-progress')).toContainText('Question 1 of 10');
});
