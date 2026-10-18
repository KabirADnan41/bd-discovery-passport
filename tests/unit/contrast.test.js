// @vitest-environment node
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

// Reads the real token file, so a palette change that breaks WCAG contrast fails the build.
const css = readFileSync(new URL('../../src/styles/tokens.css', import.meta.url), 'utf8');
const block = selector => css.slice(css.indexOf(selector)).split(/\n}\n/)[0];
const parse = text => Object.fromEntries([...text.matchAll(/--([\w-]+):\s*(#[0-9a-f]{6})/gi)].map(([, k, v]) => [k, v]));

const light = parse(block(':root {'));
const dark = { ...light, ...parse(block(":root[data-theme='dark']")) };
// the opacity the rest of the land softens to while a district is selected (a number, so not in the hex tokens above)
const softenOf = text => Number(text.match(/--map-soften:\s*([\d.]+)/)?.[1]);
const lightSoften = softenOf(block(':root {'));
const darkSoften = softenOf(block(":root[data-theme='dark']")) || lightSoften;
// a colour at an opacity over another, composited as the browser does (in sRGB)
const over = (hex, under, alpha) =>
  `#${[1, 3, 5]
    .map(i => Math.round(alpha * parseInt(hex.slice(i, i + 2), 16) + (1 - alpha) * parseInt(under.slice(i, i + 2), 16)))
    .map(v => v.toString(16).padStart(2, '0'))
    .join('')}`;
// light tokens that point at palette variables
const resolve = (tokens, name) => {
  const direct = tokens[name];
  if (direct) return direct;
  const ref = css.match(new RegExp(`--${name}:\\s*var\\(--([\\w-]+)\\)`))?.[1];
  return ref ? tokens[ref] : undefined;
};

const luminance = hex => {
  const [r, g, b] = hex.slice(1).match(/../g).map(x => parseInt(x, 16) / 255).map(c => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};
export const contrast = (a, b) => {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
};

const TEXT = ['text-primary', 'text-secondary', 'text-muted', 'accent-stamp-text', 'text-success', 'accent-brass-text'];
const SURFACES = ['surface-canvas', 'surface-sheet', 'surface-paper', 'surface-sunk'];
// the map's own small text: the coordinates and the Bay of Bengal, on the atlas sheet (and on the bare canvas below 1024px)
const MAP_LABELS = ['map-coordinate', 'map-water-label'];

describe.each([
  ['light', light, lightSoften],
  ['dark', dark, darkSoften],
])('%s theme tokens', (_, tokens, soften) => {
  it.each(TEXT.flatMap(t => SURFACES.map(s => [t, s])))('%s on %s meets WCAG AA (4.5:1)', (text, surface) => {
    const fg = resolve(tokens, text);
    const bg = resolve(tokens, surface);
    expect(fg, text).toBeTruthy();
    expect(bg, surface).toBeTruthy();
    expect(contrast(fg, bg)).toBeGreaterThanOrEqual(4.5);
  });

  it('focus ring is visible against the page (3:1 non-text)', () => {
    expect(contrast(resolve(tokens, 'focus-ring'), resolve(tokens, 'surface-canvas'))).toBeGreaterThanOrEqual(3);
  });

  it('discovered districts stand out from the page (3:1 non-text)', () => {
    expect(contrast(resolve(tokens, 'map-discovered'), resolve(tokens, 'surface-canvas'))).toBeGreaterThanOrEqual(3);
  });

  it('discovered districts stand out from the atlas sheet (3:1 non-text)', () => {
    expect(contrast(resolve(tokens, 'map-discovered'), resolve(tokens, 'surface-sheet'))).toBeGreaterThanOrEqual(3);
  });

  it('discovered and unexplored districts are told apart at a glance (3:1 non-text)', () => {
    const unexplored = resolve(tokens, 'map-locked');
    expect(unexplored, 'map-locked').toBeTruthy();
    expect(contrast(resolve(tokens, 'map-discovered'), unexplored)).toBeGreaterThanOrEqual(3);
  });

  it('with a district selected, the softened land still tells discovered from unexplored and from the sheet (3:1 non-text)', () => {
    expect(soften).toBeGreaterThan(0);
    expect(soften).toBeLessThanOrEqual(1);
    const sheet = resolve(tokens, 'surface-sheet');
    const discovered = over(resolve(tokens, 'map-discovered'), sheet, soften);
    expect(contrast(discovered, over(resolve(tokens, 'map-locked'), sheet, soften))).toBeGreaterThanOrEqual(3);
    expect(contrast(discovered, sheet)).toBeGreaterThanOrEqual(3);
  });

  it.each(MAP_LABELS.flatMap(t => ['surface-canvas', 'surface-sheet'].map(s => [t, s])))('%s on %s meets WCAG AA (4.5:1)', (text, surface) => {
    const fg = resolve(tokens, text);
    expect(fg, text).toBeTruthy();
    expect(contrast(fg, resolve(tokens, surface))).toBeGreaterThanOrEqual(4.5);
  });

  it('wrong quiz guesses stand out from the page (3:1 non-text)', () => {
    expect(contrast(resolve(tokens, 'map-wrong'), resolve(tokens, 'surface-canvas'))).toBeGreaterThanOrEqual(3);
  });

  it('control borders are visible against the page and the paper (3:1 non-text)', () => {
    expect(contrast(resolve(tokens, 'rule-strong'), resolve(tokens, 'surface-canvas'))).toBeGreaterThanOrEqual(3);
    expect(contrast(resolve(tokens, 'rule-strong'), resolve(tokens, 'surface-paper'))).toBeGreaterThanOrEqual(3);
  });

  it('"In your trip" meets WCAG AA (4.5:1) on its green tint, and its border shows against the paper (3:1 non-text)', () => {
    const paper = resolve(tokens, 'surface-paper');
    const success = resolve(tokens, 'text-success');
    expect(contrast(success, over(success, paper, 0.09))).toBeGreaterThanOrEqual(4.5);
    expect(contrast(over(success, paper, 0.7), paper)).toBeGreaterThanOrEqual(3);
  });

  // A trip's route (and the planner's rail) and its pins are non-text graphics on the land. A route is --route-river with a paper
  // casing under it; a pin is an ink disc with a paper outline. Each must show (3:1) against every ground it can sit on, by its
  // own colour or by its casing/outline, and the line must also read on the paper of the planner.
  describe('trip route and pins', () => {
    const grounds = ['map-discovered', 'map-locked', 'map-locked-hatch'];
    it.each(grounds)('the route (with its casing) shows on %s (3:1 non-text)', ground => {
      const line = resolve(tokens, 'route-river');
      const casing = resolve(tokens, 'surface-paper');
      const under = resolve(tokens, ground);
      expect(line, 'route-river').toBeTruthy();
      expect(Math.max(contrast(line, under), contrast(casing, under))).toBeGreaterThanOrEqual(3);
    });
    it.each(grounds)('the route line itself keeps 3:1 on %s unless its casing carries it (green only)', ground => {
      const direct = contrast(resolve(tokens, 'route-river'), resolve(tokens, ground));
      if (ground === 'map-discovered') expect(direct).toBeLessThan(3); // the reason for the casing
      else expect(direct).toBeGreaterThanOrEqual(3);
    });
    it('the route line shows against its casing, the paper and the sheet (3:1 non-text)', () => {
      const line = resolve(tokens, 'route-river');
      for (const s of ['surface-paper', 'surface-sheet', 'surface-canvas']) expect(contrast(line, resolve(tokens, s))).toBeGreaterThanOrEqual(3);
    });
    it.each(grounds)('a pin (ink disc, paper outline) shows on %s (3:1 non-text)', ground => {
      const under = resolve(tokens, ground);
      const disc = contrast(resolve(tokens, 'text-primary'), under);
      const outline = contrast(resolve(tokens, 'surface-paper'), under);
      expect(Math.max(disc, outline)).toBeGreaterThanOrEqual(3);
    });
    it('a pin disc shows against its paper outline (3:1 non-text)', () => {
      expect(contrast(resolve(tokens, 'text-primary'), resolve(tokens, 'surface-paper'))).toBeGreaterThanOrEqual(3);
    });
  });

  it('text on the green cover meets WCAG AA (4.5:1)', () => {
    expect(contrast(resolve(tokens, 'text-on-cover'), resolve(tokens, 'surface-cover'))).toBeGreaterThanOrEqual(4.5);
  });
});
