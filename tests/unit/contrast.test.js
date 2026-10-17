// @vitest-environment node
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

// Reads the real token file, so a palette change that breaks WCAG contrast fails the build.
const css = readFileSync(new URL('../../src/styles/tokens.css', import.meta.url), 'utf8');
const block = selector => css.slice(css.indexOf(selector)).split(/\n}\n/)[0];
const parse = text => Object.fromEntries([...text.matchAll(/--([\w-]+):\s*(#[0-9a-f]{6})/gi)].map(([, k, v]) => [k, v]));

const light = parse(block(':root {'));
const dark = { ...light, ...parse(block(":root[data-theme='dark']")) };
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
  ['light', light],
  ['dark', dark],
])('%s theme tokens', (_, tokens) => {
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

  it('text on the green cover meets WCAG AA (4.5:1)', () => {
    expect(contrast(resolve(tokens, 'text-on-cover'), resolve(tokens, 'surface-cover'))).toBeGreaterThanOrEqual(4.5);
  });
});
