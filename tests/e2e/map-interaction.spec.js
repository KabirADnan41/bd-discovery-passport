import { test, expect } from './fixtures.js';

// The map's interaction states (the hover lift, the press, the locked selection and the softened land) are drawn by overlay
// copies above the districts. These check behaviour, not timings: the copies mirror state and never take the pointer, and the
// districts themselves never move.

const district = (page, id) => page.locator(`[data-district-id="${id}"]`);
const hoverCopy = page => page.locator('.overlay-hover');
const selection = page => page.locator('.overlay-selection');
const style = (locator, property) => locator.evaluate((el, p) => getComputedStyle(el)[p], property);
const landOpacity = page => page.locator('.map-land').evaluate(el => Number(getComputedStyle(el).opacity));
// how far up an element is translated (0 when it is not); negative is a lift
const liftOf = locator => locator.evaluate(el => Number.parseFloat(getComputedStyle(el).translate.split(' ')[1] ?? '0'));
const scaleOf = locator => locator.evaluate(el => Number.parseFloat(getComputedStyle(el).scale.replace('none', '1')));
const unmoved = locator => locator.evaluate(el => ['transform', 'translate', 'scale'].every(p => getComputedStyle(el)[p] === 'none'));

// A point inside a district's shape, in page coordinates: its bounding box centre, checked to be on the shape.
const centreOf = (page, id) =>
  page.evaluate(id => {
    const path = document.getElementById(`district-${id}`);
    const box = path.getBBox();
    const p = new DOMPoint(box.x + box.width / 2, box.y + box.height / 2);
    if (!path.isPointInFill(p)) throw new Error(`the centre of district ${id} is outside its shape`);
    const s = p.matrixTransform(path.getScreenCTM());
    return { x: s.x, y: s.y };
  }, id);
// the id of the element a pointer at that point would hit
const hitAt = (page, { x, y }) => page.evaluate(([x, y]) => document.elementFromPoint(x, y)?.id ?? null, [x, y]);
// the timing of an element's CSS entrance, as computed (it stays readable after the entrance has finished)
const entranceOf = locator =>
  locator.evaluate(el => {
    const s = getComputedStyle(el);
    return { name: s.animationName, delay: s.animationDelay, fill: s.animationFillMode };
  });
// the first keyframe of a named @keyframes rule in the page's own stylesheets
const firstKeyframe = (page, name) =>
  page.evaluate(name => {
    const find = rules => {
      for (const rule of rules) {
        if (rule instanceof CSSKeyframesRule && rule.name === name) return rule.cssRules[0];
        const nested = rule.cssRules && find(rule.cssRules);
        if (nested) return nested;
      }
      return null;
    };
    for (const sheet of document.styleSheets) {
      const frame = find(sheet.cssRules);
      if (frame) return { at: frame.keyText, opacity: frame.style.opacity };
    }
    return null;
  }, name);

test.beforeEach(async ({ page }) => {
  // Sylhet (54) is discovered; Sunamganj (53), next to it, is not
  await page.addInitScript(() => localStorage.setItem('bd-discovery-passport:v1', JSON.stringify({ discovered: ['54'] })));
  await page.goto('/');
});

test('hovering lifts a copy of the district in its own state, and the copy never takes the pointer', async ({ page, isMobile }) => {
  test.skip(isMobile, 'hover is for mouse pointers only');
  await district(page, '53').hover();
  await expect(hoverCopy(page)).toHaveAttribute('data-state', 'locked');
  await district(page, '54').hover();
  await expect(hoverCopy(page)).toHaveAttribute('data-state', 'discovered');
  await expect.poll(() => liftOf(hoverCopy(page))).toBeLessThan(0);
  expect(await style(hoverCopy(page), 'pointerEvents')).toBe('none');
  // a copy, not a district: the map still has 64 districts, and the one under the pointer is the real path
  await expect(page.locator('[data-district-id]')).toHaveCount(64);
  expect(await hitAt(page, await centreOf(page, '54'))).toBe('district-54');
});

test('a press compresses the lifted copy, and the districts themselves never move', async ({ page, isMobile }) => {
  test.skip(isMobile, 'the lift and the press are for mouse pointers');
  const sylhet = district(page, '54');
  await sylhet.hover();
  await expect.poll(() => liftOf(hoverCopy(page))).toBeLessThan(0);
  expect(await unmoved(sylhet)).toBe(true);
  await page.mouse.down();
  await expect.poll(() => scaleOf(hoverCopy(page))).toBeLessThan(1);
  expect(await unmoved(sylhet)).toBe(true);
  await page.mouse.up(); // the click selects it
  await expect(selection(page)).toHaveCount(1);
  await expect.poll(() => liftOf(selection(page))).toBeLessThan(0);
  await expect.poll(() => scaleOf(selection(page))).toBe(1);
  expect(await unmoved(sylhet)).toBe(true);
});

test('a press darkens the copy over the pressed district, hovered or already selected, also with reduced motion', async ({
  page,
  isMobile,
}) => {
  test.skip(isMobile, 'the hover copy is for mouse pointers');
  // with reduced motion nothing moves, so the copy covers the district completely: the copy itself must show the press
  await page.emulateMedia({ reducedMotion: 'reduce' });
  const pressed = locator => style(locator, 'filter').then(filter => filter.includes('brightness(0.9)'));
  await district(page, '54').hover();
  await expect(hoverCopy(page)).toHaveAttribute('data-state', 'discovered');
  expect(await pressed(hoverCopy(page))).toBe(false);
  await page.mouse.down();
  await expect.poll(() => pressed(hoverCopy(page))).toBe(true);
  await page.mouse.up(); // the click selects it
  await expect(selection(page)).toHaveCount(1);
  expect(await pressed(selection(page))).toBe(false);
  await page.mouse.down();
  await expect.poll(() => pressed(selection(page))).toBe(true);
  await page.mouse.up();
});

test('selecting locks a lifted copy and softens the rest of the land; closing the page clears both', async ({ page }) => {
  expect(await landOpacity(page)).toBe(1);
  await district(page, '54').click();
  await expect(selection(page).locator('.overlay-selected-lift')).toHaveCount(1);
  expect(await style(selection(page), 'pointerEvents')).toBe('none');
  await expect.poll(() => landOpacity(page)).toBeLessThan(1);
  // the real district is still what a pointer hits at its centre, under the lifted copy
  expect(await hitAt(page, await centreOf(page, '54'))).toBe('district-54');
  await page.getByRole('dialog', { name: 'Sylhet' }).getByRole('button', { name: 'Close' }).click();
  await expect(selection(page)).toHaveCount(0);
  await expect.poll(() => landOpacity(page)).toBe(1);
});

test('beside the map the whole card waits for the map, then enters as one surface; phones and reduced motion do not wait', async ({
  page,
  isMobile,
}) => {
  const card = page.getByRole('dialog', { name: 'Sylhet' });
  await district(page, '54').click();
  await expect(card).toBeVisible();
  expect(await card.evaluate(el => el.inert)).toBe(false); // focus can land in it while it enters
  if (isMobile) {
    // the phone sheet keeps its own slide, and its page its fade, with no wait
    expect((await entranceOf(card)).name).toBe('none');
    expect((await entranceOf(card.locator('.passport-enter'))).delay).toBe('0s');
  } else {
    // band and page are held fully transparent through the wait, then enter together: the page has no entrance of its own
    expect(await entranceOf(card)).toEqual({ name: 'page-from-map', delay: '0.07s', fill: 'backwards' });
    expect(await firstKeyframe(page, 'page-from-map')).toEqual({ at: '0%', opacity: '0' });
    expect((await entranceOf(card.locator('.passport-enter'))).name).toBe('none');
  }
  // reduced motion: no wait and no slide
  await card.getByRole('button', { name: 'Close' }).click();
  await expect(card).toHaveCount(0);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await district(page, '54').click();
  await expect(card).toBeVisible();
  expect((await entranceOf(card)).name).toBe('none');
  expect(await entranceOf(card.locator('.passport-enter'))).toMatchObject({ name: 'fade-in', delay: '0s' });
});

test('with reduced motion the copies neither move nor animate, and the selection is just as clear', async ({ page, isMobile }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  const overlays = () =>
    page.evaluate(() =>
      [...document.querySelectorAll('.overlay-hover, .overlay-selection, .overlay-selection *')].map(el => ({
        overlay: el.getAttribute('class'),
        moved: ['transform', 'translate', 'scale'].some(p => getComputedStyle(el)[p] !== 'none'),
        animations: el.getAnimations().length,
      })),
    );
  if (!isMobile) {
    await district(page, '53').hover();
    await expect(hoverCopy(page)).toHaveAttribute('data-state', 'locked');
    expect(await overlays()).toEqual([{ overlay: 'overlay-hover', moved: false, animations: 0 }]);
  }
  await district(page, '54').click();
  await expect(selection(page)).toBeVisible();
  for (const o of await overlays()) expect(o, o.overlay).toMatchObject({ moved: false, animations: 0 });
  // still marked: the filled copy, its paper rim and stamp outline, its shadow, and the softened land around it
  await expect(selection(page).locator('.overlay-selected-lift, .overlay-selected-halo, .overlay-selected')).toHaveCount(3);
  expect(await style(selection(page), 'filter')).toContain('drop-shadow');
  await expect.poll(() => landOpacity(page)).toBeLessThan(1);
});

test('keyboard: arrows and Enter work as before, and the focus ring sits on the lifted selection', async ({ page, isMobile }) => {
  test.skip(isMobile, 'keyboard walkthrough runs on desktop');
  const onDistrict = () => page.evaluate(() => document.activeElement?.hasAttribute('data-district-id'));
  for (let i = 0; i < 6 && !(await onDistrict()); i++) await page.keyboard.press('Tab');
  expect(await page.evaluate(() => document.activeElement?.dataset.districtId)).toBe('1');
  await page.keyboard.press('ArrowRight');
  const moved = await page.evaluate(() => document.activeElement?.dataset.districtId);
  expect(moved).not.toBe('1');
  await page.keyboard.press('Enter');
  await expect(page.locator('#passport-title')).toBeFocused();
  await expect(district(page, moved)).toHaveAttribute('data-selected', 'true');
  // back into the map from the open page: the ring is drawn on the lifted copy, not on the district under it
  for (let i = 0; i < 4 && !(await onDistrict()); i++) await page.keyboard.press('Shift+Tab');
  await expect(district(page, moved)).toBeFocused();
  const ring = page.locator('.overlay-focus');
  await expect(ring).toHaveAttribute('data-lift', 'selected');
  await expect.poll(async () => (await style(ring, 'translate')) === (await style(selection(page), 'translate'))).toBe(true);
  expect(await liftOf(ring)).toBeLessThan(0);
});

test('in a quiz the hover stays a tint the marks show through: no copy of the state, no lift', async ({ page, isMobile }) => {
  test.skip(isMobile, 'hover is for mouse pointers only');
  await page.getByRole('tab', { name: /^Quiz/ }).click();
  await district(page, '54').hover();
  await expect(hoverCopy(page)).toHaveCount(1);
  await expect(hoverCopy(page)).not.toHaveAttribute('data-state');
  expect(await liftOf(hoverCopy(page))).toBe(0);
});
