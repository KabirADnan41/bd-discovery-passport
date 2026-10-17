// @vitest-environment node
import { describe, expect, it } from 'vitest';
import places from '../../src/data/places.json';
import { MAX_DAYS, MAX_STOPS_PER_DAY } from '../../src/lib/trip';
import { MAX_SHARE_LENGTH, MAX_TOKEN_LENGTH, SHARE_PARAM, decodeTripShare, encodeTripShare } from '../../src/lib/tripShare';

const place = id => ({ kind: 'place', id });
const district = id => ({ kind: 'district', id });
const tripOf = (...days) => ({ name: '', days });
const KNOWN = new Set(['54-bichanakandi', '54-lalakhal', '1-star-mosque', '45-inani-beach', '43-patenga-sea-beach']);
const ALL_PLACE_IDS = new Set(
  Object.values(places)
    .filter(Array.isArray)
    .flat()
    .map(p => p.id),
);
const rejects = (value, reason, known = KNOWN) => expect(decodeTripShare(value, known)).toEqual({ ok: false, reason });
const districtsFrom = (start, count) => Array.from({ length: count }, (_, i) => String(start + i));

describe('the share format (v1)', () => {
  it('uses the "trip" query parameter', () => {
    expect(SHARE_PARAM).toBe('trip');
  });

  it('caps a link from the existing trip limits', () => {
    expect(MAX_SHARE_LENGTH).toBe(MAX_DAYS * MAX_STOPS_PER_DAY * (MAX_TOKEN_LENGTH + 1));
  });

  it('allows every real place id as a stop', () => {
    for (const id of ALL_PLACE_IDS) expect(id.length).toBeLessThanOrEqual(MAX_TOKEN_LENGTH);
  });
});

describe('encodeTripShare', () => {
  it('joins days with "_" and stops with ".", using ids only', () => {
    const trip = tripOf([place('54-bichanakandi'), place('54-lalakhal'), district('1')], [place('45-inani-beach')]);
    expect(encodeTripShare(trip)).toBe('54-bichanakandi.54-lalakhal.1_45-inani-beach');
  });

  it('leaves out empty days, which carry nothing to share', () => {
    expect(encodeTripShare(tripOf([place('1-star-mosque')], [], [district('54')]))).toBe('1-star-mosque_54');
    expect(encodeTripShare(tripOf([place('1-star-mosque')], []))).toBe('1-star-mosque');
  });

  it('never puts the trip name or any other text in the link', () => {
    expect(encodeTripShare({ name: 'Mum’s trip <b>', days: [[place('1-star-mosque')]] })).toBe('1-star-mosque');
  });

  it('is deterministic and does not change the trip', () => {
    const trip = tripOf([place('1-star-mosque'), district('54')]);
    const before = structuredClone(trip);
    expect(encodeTripShare(trip)).toBe(encodeTripShare(structuredClone(trip)));
    expect(trip).toEqual(before);
  });

  it('only uses characters a URL carries without escaping', () => {
    const value = encodeTripShare(tripOf([place('54-bichanakandi'), district('1')], [], [place('43-patenga-sea-beach')]));
    expect(value).toMatch(/^[a-z0-9._-]+$/);
    expect(new URLSearchParams({ [SHARE_PARAM]: value }).toString()).toBe(`${SHARE_PARAM}=${value}`);
  });

  it('fits the largest possible trip of real places within the cap, and reads it back', () => {
    const longest = [...ALL_PLACE_IDS].sort((a, b) => b.length - a.length).slice(0, MAX_DAYS * MAX_STOPS_PER_DAY);
    const days = Array.from({ length: MAX_DAYS }, (_, d) => longest.slice(d * MAX_STOPS_PER_DAY, (d + 1) * MAX_STOPS_PER_DAY).map(place));
    const value = encodeTripShare(tripOf(...days));
    expect(value.length).toBeLessThanOrEqual(MAX_SHARE_LENGTH);
    expect(decodeTripShare(value, ALL_PLACE_IDS)).toEqual({ ok: true, trip: tripOf(...days) });
  });
});

describe('decodeTripShare accepts', () => {
  it('a valid link, rebuilding the trip from its ids', () => {
    expect(decodeTripShare('54-bichanakandi.54-lalakhal.1_45-inani-beach', KNOWN)).toEqual({
      ok: true,
      trip: tripOf([place('54-bichanakandi'), place('54-lalakhal'), district('1')], [place('45-inani-beach')]),
    });
  });

  it('whatever it encodes, with any empty days left out', () => {
    const trip = tripOf([district('64')], [], [place('43-patenga-sea-beach'), place('54-lalakhal')], []);
    expect(decodeTripShare(encodeTripShare(trip), KNOWN)).toEqual({
      ok: true,
      trip: tripOf([district('64')], [place('43-patenga-sea-beach'), place('54-lalakhal')]),
    });
  });

  it(`exactly ${MAX_DAYS} days, and exactly ${MAX_STOPS_PER_DAY} stops in a day`, () => {
    const tenDays = districtsFrom(1, MAX_DAYS);
    expect(decodeTripShare(tenDays.join('_'), KNOWN)).toEqual({ ok: true, trip: tripOf(...tenDays.map(id => [district(id)])) });
    const fullDay = districtsFrom(1, MAX_STOPS_PER_DAY);
    expect(decodeTripShare(fullDay.join('.'), KNOWN)).toEqual({ ok: true, trip: tripOf(fullDay.map(district)) });
  });

  it('district-only links without any known place ids', () => {
    expect(decodeTripShare('54.1', undefined)).toEqual({ ok: true, trip: tripOf([district('54'), district('1')]) });
  });
});

describe('decodeTripShare rejects', () => {
  it('a missing, empty or non-string value', () => {
    for (const value of [null, undefined, '', 42, {}, ['1']]) rejects(value, 'missing');
  });

  it('a link longer than the cap, before looking inside it', () => {
    rejects('1.'.repeat(MAX_SHARE_LENGTH), 'too-long');
    rejects('X'.repeat(MAX_SHARE_LENGTH + 1), 'too-long'); // bad characters too, but length is checked first
  });

  it('any character outside lowercase letters, digits, "-", "." and "_"', () => {
    for (const value of ['54-Bichanakandi', '1-star mosque', '1-star%20mosque', '<script>', '1,2', '১', '1-star-mosque#x', '1-star-mosque/..', '1;2']) {
      rejects(value, 'bad-characters');
    }
  });

  it(`more than ${MAX_DAYS} days`, () => {
    rejects(districtsFrom(1, MAX_DAYS + 1).join('_'), 'too-many-days');
  });

  it(`more than ${MAX_STOPS_PER_DAY} stops in a day`, () => {
    rejects(districtsFrom(1, MAX_STOPS_PER_DAY + 1).join('.'), 'too-many-stops');
  });

  it('an empty or malformed stop, or an unknown district', () => {
    for (const value of ['0', '01', '65', '99', '54-', '-1', '54--x', 'x-54', '054-x', '1-star-mosque..1', '.1', '1.', '1-star-mosque.', '1._54']) {
      rejects(value, 'bad-stop');
    }
  });

  it(`a stop id longer than ${MAX_TOKEN_LENGTH} characters`, () => {
    rejects(`1-${'a'.repeat(MAX_TOKEN_LENGTH)}`, 'bad-stop');
  });

  it('a well-formed place id that is not a known place', () => {
    rejects('54-gone-place', 'unknown-place');
    rejects('1-star-mosque', 'unknown-place', undefined); // no known ids given: no place is trusted
  });

  it('the same stop twice, in one day or across days', () => {
    rejects('1-star-mosque.1-star-mosque', 'duplicate');
    rejects('54_54', 'duplicate');
    rejects('54-lalakhal_1.54-lalakhal', 'duplicate');
  });

  it('empty days, including stray "_" at the start or end', () => {
    for (const value of ['_', '__', '_54', '54_', '1-star-mosque__54', '_'.repeat(MAX_DAYS - 1), '__proto__']) rejects(value, 'empty-day');
  });

  it('never throws, whatever it is given', () => {
    for (const value of [42, {}, [], 'a'.repeat(100_000), '\u0000', '_'.repeat(50)]) {
      expect(() => decodeTripShare(value, KNOWN)).not.toThrow();
    }
  });
});
