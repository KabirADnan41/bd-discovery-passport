// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { categoryBn, directionsUrl } from '../../src/lib/places';
import CATEGORIES_BN from '../../src/data/categories.bn.json';

const PREFIX = 'https://www.google.com/maps/dir/?api=1&destination=';

describe('directionsUrl', () => {
  it('builds a no-key Google Maps directions link to the name and address', () => {
    expect(directionsUrl('Lalbagh Fort', 'Lalbagh, Old Dhaka, Dhaka')).toBe(
      `${PREFIX}Lalbagh%20Fort%2C%20Lalbagh%2C%20Old%20Dhaka%2C%20Dhaka%2C%20Bangladesh`,
    );
  });

  it('encodes apostrophes, ampersands and other reserved characters so the query cannot break', () => {
    const url = directionsUrl("St. Martin's Island & Chera Dwip", "Teknaf, Cox's Bazar");
    expect(url.startsWith(PREFIX)).toBe(true);
    const destination = url.slice(PREFIX.length);
    expect(destination).not.toMatch(/[&#?= ]/);
    expect(new URL(url).searchParams.get('destination')).toBe("St. Martin's Island & Chera Dwip, Teknaf, Cox's Bazar, Bangladesh");
    expect(new URL(url).searchParams.get('api')).toBe('1');
  });
});

describe('categoryBn', () => {
  it('gives the Bengali label for a place category', () => {
    expect(categoryBn('Historic lake')).toBe(CATEGORIES_BN['Historic lake']);
    expect(categoryBn('Historic lake')).toMatch(/[ঀ-৿]/);
  });

  it('gives nothing for a category without a label, so the chip stays English', () => {
    expect(categoryBn('Not a place category')).toBeUndefined();
    expect(categoryBn(undefined)).toBeUndefined();
  });

  it('reads only the label file own keys, never inherited object members', () => {
    for (const key of ['constructor', 'toString', '__proto__', 'hasOwnProperty']) expect(categoryBn(key)).toBeUndefined();
  });
});
