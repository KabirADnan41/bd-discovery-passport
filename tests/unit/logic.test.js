// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { discoveryReducer } from '../../src/hooks/useDiscoveryState';
import { STORAGE_KEY, clearDiscovered, loadDiscovered, saveDiscovered } from '../../src/lib/discoveryStorage';
import { nextDistrictInDirection } from '../../src/lib/mapNavigation';
import { dampedOffset, shouldDismiss } from '../../src/lib/sheetGesture';
import { DISTRICTS, DISTRICT_IDS, FEATURED_IDS, formatBn, getDistrictDetails } from '../../src/lib/districtData';

const memoryStorage = (initial = {}) => {
  const data = { ...initial };
  return { getItem: k => data[k] ?? null, setItem: (k, v) => (data[k] = String(v)), removeItem: k => delete data[k], data };
};

describe('discovery reducer', () => {
  const empty = { discovered: [], selectedId: null, justDiscoveredId: null };

  it('first activation discovers, selects and flags a new stamp', () => {
    const s = discoveryReducer(empty, { type: 'activate', id: '54' });
    expect(s).toEqual({ discovered: ['54'], selectedId: '54', justDiscoveredId: '54' });
  });

  it('re-activating does not count twice and is not a new stamp', () => {
    const once = discoveryReducer(empty, { type: 'activate', id: '54' });
    const twice = discoveryReducer(discoveryReducer(once, { type: 'close' }), { type: 'activate', id: '54' });
    expect(twice.discovered).toEqual(['54']);
    expect(twice.justDiscoveredId).toBeNull();
  });

  it('ignores ids that are not real districts', () => {
    expect(discoveryReducer(empty, { type: 'activate', id: '65' })).toBe(empty);
    expect(discoveryReducer(empty, { type: 'activate', id: '<img>' })).toBe(empty);
  });

  it('load switches the source, keeps an open page and counts it as discovered', () => {
    const open = discoveryReducer({ ...empty, source: 'pending' }, { type: 'activate', id: '45' });
    const loaded = discoveryReducer(open, { type: 'load', source: 'account', discovered: ['1', '99'] });
    expect(loaded.discovered).toEqual(['1', '45']);
    expect(loaded.selectedId).toBe('45');
    expect(loaded.source).toBe('account');
  });

  it('load without a list keeps the current stamps (a pending passport becoming the guest passport)', () => {
    const pending = { discovered: ['1', '54'], selectedId: null, justDiscoveredId: null, source: 'pending' };
    expect(discoveryReducer(pending, { type: 'load', source: 'guest' })).toEqual({ ...pending, source: 'guest' });
  });

  it('reset keeps the source (an account passport stays an account passport)', () => {
    const s2 = discoveryReducer({ discovered: ['1'], selectedId: '1', justDiscoveredId: null, source: 'account' }, { type: 'reset' });
    expect(s2).toEqual({ discovered: [], selectedId: null, justDiscoveredId: null, source: 'account' });
  });

  it('reset clears everything', () => {
    const s = discoveryReducer({ discovered: ['1', '2'], selectedId: '2', justDiscoveredId: null }, { type: 'reset' });
    expect(s).toEqual(empty);
  });
});

describe('discovery storage', () => {
  it('round-trips ids under the versioned key', () => {
    const storage = memoryStorage();
    saveDiscovered(['1', '54'], storage);
    expect(JSON.parse(storage.data[STORAGE_KEY])).toEqual({ discovered: ['1', '54'] });
    expect(loadDiscovered(DISTRICT_IDS, storage)).toEqual(['1', '54']);
    clearDiscovered(storage);
    expect(loadDiscovered(DISTRICT_IDS, storage)).toEqual([]);
  });

  it('treats stored data as untrusted: drops junk, unknown ids and duplicates', () => {
    const storage = memoryStorage({ [STORAGE_KEY]: JSON.stringify({ discovered: ['1', '1', 7, '99', null, '<script>', '64'] }) });
    expect(loadDiscovered(DISTRICT_IDS, storage)).toEqual(['1', '64']);
  });

  it('survives corrupt JSON and blocked storage', () => {
    expect(loadDiscovered(DISTRICT_IDS, memoryStorage({ [STORAGE_KEY]: '{not json' }))).toEqual([]);
    const throwing = { getItem: () => { throw new Error('blocked'); }, setItem: () => { throw new Error('blocked'); } };
    expect(loadDiscovered(DISTRICT_IDS, throwing)).toEqual([]);
    expect(() => saveDiscovered(['1'], throwing)).not.toThrow();
  });
});

describe('map data and navigation', () => {
  it('has exactly the 64 source districts', () => {
    expect(DISTRICTS).toHaveLength(64);
    expect(DISTRICT_IDS.size).toBe(64);
  });

  it('arrow keys move to a neighbour in that direction', () => {
    const dhaka = DISTRICTS.find(d => d.id === '1');
    const up = DISTRICTS.find(d => d.id === nextDistrictInDirection(DISTRICTS, '1', 'ArrowUp'));
    const right = DISTRICTS.find(d => d.id === nextDistrictInDirection(DISTRICTS, '1', 'ArrowRight'));
    expect(up.label[1]).toBeLessThan(dhaka.label[1]);
    expect(right.label[0]).toBeGreaterThan(dhaka.label[0]);
  });

  it('the southernmost district has nothing further down', () => {
    const south = DISTRICTS.reduce((a, b) => (b.label[1] > a.label[1] ? b : a));
    expect(nextDistrictInDirection(DISTRICTS, south.id, 'ArrowDown')).toBeNull();
  });

  it('only verified content reaches the card, with the curated stamp code', () => {
    expect(getDistrictDetails('45').content.contentStatus).toBe('verified');
    expect(getDistrictDetails('45').stampCode).toBe('CXB');
    expect(getDistrictDetails('30').content).toBeNull(); // Nilphamari: coming soon
    expect(FEATURED_IDS).toEqual(['1', '45', '54', '64']);
  });

  it('formats Bengali numerals with Intl', () => {
    expect(formatBn(1479)).toBe('১,৪৭৯');
  });
});

describe('sheet drag gesture', () => {
  it('a quick flick dismisses regardless of distance', () => {
    expect(shouldDismiss({ dy: 40, elapsedMs: 100, sheetHeight: 600 })).toBe(true); // 0.4 px/ms
  });
  it('a slow short drag snaps back', () => {
    expect(shouldDismiss({ dy: 60, elapsedMs: 800, sheetHeight: 600 })).toBe(false);
  });
  it('a long slow drag past 30% dismisses', () => {
    expect(shouldDismiss({ dy: 200, elapsedMs: 3000, sheetHeight: 600 })).toBe(true);
  });
  it('upward drag meets friction and never dismisses', () => {
    expect(Math.abs(dampedOffset(-100))).toBeLessThan(100);
    expect(shouldDismiss({ dy: -300, elapsedMs: 50, sheetHeight: 600 })).toBe(false);
  });
});
