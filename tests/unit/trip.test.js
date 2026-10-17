// @vitest-environment node
import { describe, expect, it } from 'vitest';
import {
  MAX_DAYS,
  MAX_NAME_LENGTH,
  MAX_STOPS_PER_DAY,
  addDay,
  addStop,
  clearTrip,
  createTrip,
  dayDirectionsUrl,
  hasStop,
  legDistancesKm,
  loadTrip,
  locationOf,
  moveStop,
  pruneUnknownPlaces,
  removeDay,
  removeStop,
  renameTrip,
  saveTrip,
  tripMapData,
} from '../../src/lib/trip';
import { TRIP_KEY } from '../../src/lib/discoveryStorage';
import { directionsUrl } from '../../src/lib/places';
import { distanceKm } from '../../src/lib/quiz';
import { DISTRICT_IDS, getDistrict } from '../../src/lib/districtData';

const district = id => ({ kind: 'district', id });
const place = id => ({ kind: 'place', id });
const DHAKA = district('1');
const SYLHET = district('54');
const CHATTOGRAM = district('43');
const DARGAH = place('54-shah-jalal-dargah');
const STAR_MOSQUE = place('1-star-mosque');
const tripOf = (...days) => ({ name: 'Test trip', days });
const fullDay = () => [...DISTRICT_IDS].slice(0, MAX_STOPS_PER_DAY).map(district);
const MAPS = 'https://www.google.com/maps/dir/?api=1';

/** Calls `fn(input)` and checks the input is deep-equal afterwards. */
function expectUnchanged(input, fn) {
  const before = structuredClone(input);
  const result = fn(input);
  expect(input).toEqual(before);
  return result;
}

function memoryStorage(initial = {}) {
  const data = { ...initial };
  return {
    data,
    getItem: key => (key in data ? data[key] : null),
    setItem: (key, value) => {
      data[key] = String(value);
    },
    removeItem: key => {
      delete data[key];
    },
  };
}

const throwingStorage = {
  getItem() {
    throw new Error('blocked');
  },
  setItem() {
    throw new Error('quota');
  },
};

describe('createTrip', () => {
  it('starts an unnamed trip with one empty day', () => {
    expect(createTrip()).toEqual({ name: '', days: [[]] });
  });

  it('returns a new trip each time', () => {
    expect(createTrip()).not.toBe(createTrip());
  });
});

describe('hasStop', () => {
  it('finds a stop in any day by kind and id', () => {
    const trip = tripOf([DHAKA], [DARGAH]);
    expect(hasStop(trip, district('1'))).toBe(true);
    expect(hasStop(trip, place('54-shah-jalal-dargah'))).toBe(true);
    expect(hasStop(trip, SYLHET)).toBe(false);
    expect(hasStop(trip, place('1'))).toBe(false);
  });
});

describe('addStop', () => {
  it('adds to the last day by default', () => {
    const trip = addStop(tripOf([DHAKA], []), SYLHET);
    expect(trip.days).toEqual([[DHAKA], [SYLHET]]);
  });

  it('adds to a chosen day, after its other stops', () => {
    const trip = addStop(tripOf([DHAKA], []), DARGAH, 0);
    expect(trip.days).toEqual([[DHAKA, DARGAH], []]);
  });

  it('keeps only the kind and id of the stop it is given', () => {
    const trip = addStop(createTrip(), { kind: 'place', id: '1-star-mosque', name: 'Star Mosque' });
    expect(trip.days[0][0]).toEqual(STAR_MOSQUE);
  });

  it('does not change the trip or the stop it is given', () => {
    const trip = tripOf([DHAKA]);
    const stop = { ...SYLHET };
    expectUnchanged(trip, t => addStop(t, stop));
    expect(stop).toEqual(SYLHET);
  });

  it('refuses a stop that is already in the trip, on any day', () => {
    const trip = tripOf([DHAKA], [SYLHET]);
    expect(addStop(trip, district('1'))).toBe(trip);
    expect(addStop(trip, district('54'), 0)).toBe(trip);
  });

  it(`refuses to add to a day that already has ${MAX_STOPS_PER_DAY} stops`, () => {
    const trip = tripOf(fullDay());
    expect(addStop(trip, DARGAH)).toBe(trip);
  });

  it('refuses invalid stops', () => {
    const trip = createTrip();
    const invalid = [
      null,
      undefined,
      'district',
      {},
      district('99'),
      district(54),
      { kind: 'town', id: '54' },
      place('54'),
      place('99-made-up-place'),
      place('54-'),
      place('54-Shah Jalal'),
      place('-shah-jalal'),
      place('x54-shah-jalal'),
    ];
    for (const stop of invalid) expect(addStop(trip, stop)).toBe(trip);
  });

  it('refuses a day that does not exist', () => {
    const trip = tripOf([], []);
    for (const day of [2, -1, 1.5, '0', null]) expect(addStop(trip, SYLHET, day)).toBe(trip);
  });
});

describe('removeStop', () => {
  it('removes the stop at the given position', () => {
    const trip = removeStop(tripOf([DHAKA, SYLHET, DARGAH]), 0, 1);
    expect(trip.days).toEqual([[DHAKA, DARGAH]]);
  });

  it('does not change the trip it is given', () => {
    expectUnchanged(tripOf([DHAKA, SYLHET]), t => removeStop(t, 0, 0));
  });

  it('refuses a position that does not exist', () => {
    const trip = tripOf([DHAKA]);
    for (const [day, index] of [[0, 1], [0, -1], [1, 0], ['0', 0], [0, '0']]) expect(removeStop(trip, day, index)).toBe(trip);
  });
});

describe('moveStop', () => {
  it('moves a stop later within a day', () => {
    const trip = moveStop(tripOf([DHAKA, SYLHET, DARGAH]), { day: 0, index: 0 }, { day: 0, index: 2 });
    expect(trip.days).toEqual([[SYLHET, DARGAH, DHAKA]]);
  });

  it('moves a stop earlier within a day', () => {
    const trip = moveStop(tripOf([DHAKA, SYLHET, DARGAH]), { day: 0, index: 2 }, { day: 0, index: 0 });
    expect(trip.days).toEqual([[DARGAH, DHAKA, SYLHET]]);
  });

  it('moves a stop into another day at the given index, including the end', () => {
    const start = tripOf([DHAKA, SYLHET], [CHATTOGRAM]);
    expect(moveStop(start, { day: 0, index: 1 }, { day: 1, index: 0 }).days).toEqual([[DHAKA], [SYLHET, CHATTOGRAM]]);
    expect(moveStop(start, { day: 0, index: 1 }, { day: 1, index: 1 }).days).toEqual([[DHAKA], [CHATTOGRAM, SYLHET]]);
  });

  it('can empty a day by moving its last stop away', () => {
    const trip = moveStop(tripOf([DHAKA], []), { day: 0, index: 0 }, { day: 1, index: 0 });
    expect(trip.days).toEqual([[], [DHAKA]]);
  });

  it('does not change the trip it is given', () => {
    expectUnchanged(tripOf([DHAKA, SYLHET], [CHATTOGRAM]), t => moveStop(t, { day: 0, index: 0 }, { day: 1, index: 1 }));
  });

  it('refuses a move into another day that is full', () => {
    const trip = tripOf([DARGAH], fullDay());
    expect(moveStop(trip, { day: 0, index: 0 }, { day: 1, index: 0 })).toBe(trip);
  });

  it('still reorders within a full day', () => {
    const day = fullDay();
    const trip = moveStop(tripOf(day), { day: 0, index: 0 }, { day: 0, index: MAX_STOPS_PER_DAY - 1 });
    expect(trip.days[0]).toEqual([...day.slice(1), day[0]]);
  });

  it('refuses positions that do not exist', () => {
    const trip = tripOf([DHAKA, SYLHET], [CHATTOGRAM]);
    const bad = [
      [{ day: 0, index: 2 }, { day: 1, index: 0 }],
      [{ day: 2, index: 0 }, { day: 1, index: 0 }],
      [{ day: 0, index: 0 }, { day: 2, index: 0 }],
      [{ day: 0, index: 0 }, { day: 1, index: 2 }],
      [{ day: 0, index: 0 }, { day: 0, index: 2 }],
      [{ day: 0, index: 0 }, { day: 1, index: -1 }],
      [{ day: '0', index: 0 }, { day: 1, index: 0 }],
    ];
    for (const [from, to] of bad) expect(moveStop(trip, from, to)).toBe(trip);
  });
});

describe('addDay', () => {
  it('adds an empty day at the end', () => {
    expect(addDay(tripOf([DHAKA])).days).toEqual([[DHAKA], []]);
  });

  it('does not change the trip it is given', () => {
    expectUnchanged(tripOf([DHAKA]), addDay);
  });

  it(`refuses to go past ${MAX_DAYS} days`, () => {
    const trip = tripOf(...Array.from({ length: MAX_DAYS }, () => []));
    expect(addDay(trip)).toBe(trip);
  });
});

describe('removeDay', () => {
  it('removes the day and its stops', () => {
    const trip = removeDay(tripOf([DHAKA], [SYLHET, DARGAH], [CHATTOGRAM]), 1);
    expect(trip.days).toEqual([[DHAKA], [CHATTOGRAM]]);
    expect(hasStop(trip, DARGAH)).toBe(false);
  });

  it('always keeps at least one day', () => {
    expect(removeDay(tripOf([DHAKA, SYLHET]), 0).days).toEqual([[]]);
  });

  it('does not change the trip it is given', () => {
    expectUnchanged(tripOf([DHAKA], [SYLHET]), t => removeDay(t, 0));
  });

  it('refuses a day that does not exist', () => {
    const trip = tripOf([DHAKA]);
    for (const day of [1, -1, '0', undefined]) expect(removeDay(trip, day)).toBe(trip);
  });
});

describe('renameTrip', () => {
  it('sets the name, trimmed', () => {
    expect(renameTrip(createTrip(), '  Sylhet tea weekend  ').name).toBe('Sylhet tea weekend');
  });

  it(`cuts a name to ${MAX_NAME_LENGTH} characters`, () => {
    const name = renameTrip(createTrip(), `  ${'a'.repeat(MAX_NAME_LENGTH + 20)}  `).name;
    expect(name).toBe('a'.repeat(MAX_NAME_LENGTH));
  });

  it('does not change the trip it is given', () => {
    expectUnchanged(tripOf([DHAKA]), t => renameTrip(t, 'New'));
  });
});

describe('locationOf', () => {
  const placesById = new Map([
    ['54-shah-jalal-dargah', { id: '54-shah-jalal-dargah', name: { en: 'Shah Jalal Dargah' }, address: 'Dargah Gate, Sylhet' }],
  ]);

  it('gives a place the same "name, address, Bangladesh" text as the Directions link', () => {
    const text = locationOf(DARGAH, placesById);
    expect(text).toBe('Shah Jalal Dargah, Dargah Gate, Sylhet, Bangladesh');
    expect(directionsUrl('Shah Jalal Dargah', 'Dargah Gate, Sylhet')).toBe(`${MAPS}&destination=${encodeURIComponent(text)}`);
  });

  it("gives a district its town's coordinates", () => {
    const sylhet = getDistrict('54');
    expect(locationOf(SYLHET)).toBe(`${sylhet.lat},${sylhet.lon}`);
  });

  it("falls back to the district town for a place that is not loaded", () => {
    expect(locationOf(STAR_MOSQUE, placesById)).toBe(locationOf(DHAKA));
    expect(locationOf(STAR_MOSQUE)).toBe(locationOf(DHAKA));
  });
});

describe('dayDirectionsUrl', () => {
  const names = { a: "Cox's Bazar Beach, Kolatoli, Cox's Bazar", b: 'Lalbagh Fort, Old Dhaka', c: 'Ratargul | Swamp', d: 'Jaflong' };
  const stops = keys => keys.map(key => ({ kind: 'place', id: key }));
  const nameOf = stop => names[stop.id];

  it('returns null for an empty day', () => {
    expect(dayDirectionsUrl([], nameOf)).toBeNull();
  });

  it('links one stop as a destination only, so Maps starts from where the user is', () => {
    const url = dayDirectionsUrl(stops(['a']), nameOf);
    expect(url).toBe(`${MAPS}&destination=${encodeURIComponent(names.a)}`);
    expect(new URL(url).searchParams.has('origin')).toBe(false);
  });

  it('links two stops as origin and destination, with no waypoints', () => {
    const params = new URL(dayDirectionsUrl(stops(['a', 'b']), nameOf)).searchParams;
    expect(params.get('api')).toBe('1');
    expect(params.get('origin')).toBe(names.a);
    expect(params.get('destination')).toBe(names.b);
    expect(params.has('waypoints')).toBe(false);
  });

  it('puts the middle stops in order as waypoints separated by |', () => {
    const url = dayDirectionsUrl(stops(['b', 'a', 'd', 'b']), nameOf);
    const params = new URL(url).searchParams;
    expect(params.get('origin')).toBe(names.b);
    expect(params.get('waypoints')).toBe(`${names.a}|${names.d}`);
    expect(params.get('destination')).toBe(names.b);
    expect(url).toContain(`waypoints=${encodeURIComponent(names.a)}%7C${encodeURIComponent(names.d)}`);
  });

  it('encodes apostrophes, commas and spaces so the query cannot break', () => {
    const url = dayDirectionsUrl(stops(['a', 'd', 'b']), nameOf);
    const query = url.slice(MAPS.length);
    expect(query).not.toMatch(/[ ,|#?]/);
    expect(query.split('&').filter(Boolean)).toHaveLength(3);
    const params = new URL(url).searchParams;
    expect([params.get('origin'), params.get('waypoints'), params.get('destination')]).toEqual([names.a, names.d, names.b]);
  });

  it('turns a | inside a location into a space, so it cannot split the waypoints', () => {
    const waypoints = new URL(dayDirectionsUrl(stops(['a', 'c', 'd', 'b']), nameOf)).searchParams.get('waypoints');
    expect(waypoints.split('|')).toEqual([names.c.replace('|', ' '), names.d]);
  });

  it(`has at most ${MAX_STOPS_PER_DAY - 2} waypoints for a full day`, () => {
    const url = dayDirectionsUrl(fullDay(), stop => locationOf(stop));
    expect(new URL(url).searchParams.get('waypoints').split('|')).toHaveLength(MAX_STOPS_PER_DAY - 2);
  });

  it('calls locationOf with the stop only', () => {
    const calls = [];
    dayDirectionsUrl([DHAKA, SYLHET], (...args) => {
      calls.push(args);
      return 'x';
    });
    expect(calls).toEqual([[DHAKA], [SYLHET]]);
  });
});

describe('legDistancesKm', () => {
  it('gives the straight-line km between consecutive district towns, rounded to 10 km', () => {
    const [km] = legDistancesKm([DHAKA, SYLHET]);
    expect(Number.isInteger(km)).toBe(true);
    expect(km).toBeGreaterThan(185);
    expect(km).toBeLessThan(210);
    expect(km).toBe(distanceKm(getDistrict('1'), getDistrict('54')));
  });

  it("uses a place's district town, so stops in the same district are 0 km apart", () => {
    expect(legDistancesKm([SYLHET, DARGAH, STAR_MOSQUE])).toEqual(legDistancesKm([SYLHET, SYLHET, DHAKA]));
    expect(legDistancesKm([SYLHET, DARGAH])).toEqual([0]);
  });

  it('gives one leg fewer than there are stops', () => {
    expect(legDistancesKm([])).toEqual([]);
    expect(legDistancesKm([DHAKA])).toEqual([]);
    expect(legDistancesKm([DHAKA, SYLHET, CHATTOGRAM])).toHaveLength(2);
  });

  it('does not change the stops it is given', () => {
    expectUnchanged([DHAKA, DARGAH], legDistancesKm);
  });
});

describe('tripMapData', () => {
  const SADARGHAT = place('1-sadarghat');
  const BICHANAKANDI = place('54-bichanakandi');
  const INANI_BEACH = place('45-inani-beach');
  const BOGA_LAKE = place('40-boga-lake');

  it('gives an empty trip no pins and an empty route for its one day', () => {
    expect(tripMapData(createTrip())).toEqual({ pins: [], routes: [[]] });
  });

  it('pins a place at its district and a district at itself, once each, with how many stops it has', () => {
    const { pins } = tripMapData(tripOf([DARGAH, DHAKA, BICHANAKANDI]));
    expect(pins).toEqual([
      { districtId: '54', count: 2 },
      { districtId: '1', count: 1 },
    ]);
  });

  it('counts a district stop and the places in that district on one pin, across days', () => {
    const { pins } = tripMapData(tripOf([SYLHET, STAR_MOSQUE], [DARGAH, SADARGHAT, DHAKA]));
    expect(pins).toEqual([
      { districtId: '54', count: 2 },
      { districtId: '1', count: 3 },
    ]);
  });

  it('orders the pins by first appearance', () => {
    const { pins } = tripMapData(tripOf([CHATTOGRAM], [DARGAH, DHAKA, STAR_MOSQUE]));
    expect(pins.map(pin => pin.districtId)).toEqual(['43', '54', '1']);
  });

  it('gives each day its own route: its districts in stop order', () => {
    const { routes } = tripMapData(tripOf([DHAKA, SYLHET, CHATTOGRAM], [INANI_BEACH, BOGA_LAKE]));
    expect(routes).toEqual([['1', '54', '43'], ['45', '40']]);
  });

  it('collapses stops in the same district one after another, but keeps a return to it', () => {
    const { routes } = tripMapData(tripOf([STAR_MOSQUE, SADARGHAT, SYLHET, DARGAH, place('1-national-martyrs-memorial')]));
    expect(routes).toEqual([['1', '54', '1']]);
  });

  it('never joins one day to the next, even when a day ends in the district the next one starts in', () => {
    const { routes } = tripMapData(tripOf([DHAKA, SYLHET], [DARGAH, CHATTOGRAM]));
    expect(routes).toEqual([['1', '54'], ['54', '43']]);
  });

  it('gives a day with one district a pin and a route of one, too short to draw', () => {
    const { pins, routes } = tripMapData(tripOf([DARGAH, BICHANAKANDI]));
    expect(pins).toEqual([{ districtId: '54', count: 2 }]);
    expect(routes).toEqual([['54']]);
  });

  it("keeps an empty day as an empty route, so a route's place in the list is its day", () => {
    const { routes } = tripMapData(tripOf([DHAKA], [], [SYLHET, CHATTOGRAM]));
    expect(routes).toEqual([['1'], [], ['54', '43']]);
  });

  it('does not change the trip it is given', () => {
    expectUnchanged(tripOf([DHAKA, DARGAH], [CHATTOGRAM]), tripMapData);
  });
});

describe('pruneUnknownPlaces', () => {
  it('drops places that are not in the known set and keeps districts', () => {
    const trip = tripOf([DHAKA, STAR_MOSQUE], [DARGAH]);
    expect(pruneUnknownPlaces(trip, new Set(['1-star-mosque'])).days).toEqual([[DHAKA, STAR_MOSQUE], []]);
  });

  it('keeps every stop when all places are known', () => {
    const trip = tripOf([DHAKA, STAR_MOSQUE]);
    expect(pruneUnknownPlaces(trip, new Set(['1-star-mosque']))).toEqual(trip);
  });

  it('does not change the trip it is given', () => {
    expectUnchanged(tripOf([DHAKA, STAR_MOSQUE]), t => pruneUnknownPlaces(t, new Set()));
  });
});

describe('saveTrip and loadTrip', () => {
  const saved = value => memoryStorage({ [TRIP_KEY]: typeof value === 'string' ? value : JSON.stringify(value) });

  it(`saves under ${'"bd-discovery-passport:trip:v1"'}`, () => {
    expect(TRIP_KEY).toBe('bd-discovery-passport:trip:v1');
    const storage = memoryStorage();
    saveTrip(tripOf([DHAKA]), storage);
    expect(JSON.parse(storage.data[TRIP_KEY])).toEqual(tripOf([DHAKA]));
  });

  it('loads back exactly what was saved', () => {
    const storage = memoryStorage();
    const trip = renameTrip(addStop(addDay(addStop(createTrip(), DHAKA)), DARGAH), "Mum's Sylhet trip");
    saveTrip(trip, storage);
    expect(loadTrip(storage)).toEqual(trip);
  });

  it('gives a fresh trip when nothing is saved, or the saved value is junk', () => {
    for (const storage of [memoryStorage(), saved('{not json'), saved('null'), saved('42'), saved('[]'), saved({ name: 'x' }), saved({ days: 'no' })]) {
      expect(loadTrip(storage)).toEqual(createTrip());
    }
  });

  it('never throws, even when storage is missing or throws', () => {
    expect(loadTrip(throwingStorage)).toEqual(createTrip());
    expect(loadTrip(null)).toEqual(createTrip());
    expect(() => saveTrip(tripOf([DHAKA]), throwingStorage)).not.toThrow();
    expect(() => saveTrip(tripOf([DHAKA]), null)).not.toThrow();
  });

  it('drops stops of the wrong shape, unknown districts, malformed place ids and duplicates', () => {
    const storage = saved({
      name: 'Mixed',
      days: [[DHAKA, district('99'), place('99-nowhere'), place('54 bad'), 'Sylhet', null, { ...DARGAH, extra: true }], 'not a day', [DHAKA, SYLHET]],
    });
    expect(loadTrip(storage)).toEqual({ name: 'Mixed', days: [[DHAKA, DARGAH], [SYLHET]] });
  });

  it('drops stops whose id is not a string, so later calls cannot crash', () => {
    const fresh = createTrip();
    expect(addStop(fresh, place(['1-star-mosque']))).toBe(fresh);
    const trip = loadTrip(saved({ days: [[place(['1-star-mosque']), place(1), place(null), district(['1']), DHAKA]] }));
    expect(trip.days).toEqual([[DHAKA]]);
    expect(() => legDistancesKm(trip.days[0])).not.toThrow();
  });

  it('enforces the day, stop and name limits', () => {
    const manyStops = [...DISTRICT_IDS].slice(0, MAX_STOPS_PER_DAY + 3).map(district);
    const manyDays = Array.from({ length: MAX_DAYS + 3 }, (_, i) => [place(`54-place-${i}`)]);
    const trip = loadTrip(saved({ name: ` ${'n'.repeat(200)} `, days: [manyStops, ...manyDays] }));
    expect(trip.name).toBe('n'.repeat(MAX_NAME_LENGTH));
    expect(trip.days).toHaveLength(MAX_DAYS);
    expect(trip.days[0]).toEqual(manyStops.slice(0, MAX_STOPS_PER_DAY));
  });

  it('keeps a stop cut from a full day available for a later day', () => {
    const manyStops = [...DISTRICT_IDS].slice(0, MAX_STOPS_PER_DAY + 1).map(district);
    const extra = manyStops.at(-1);
    expect(loadTrip(saved({ name: '', days: [manyStops, [extra]] })).days[1]).toEqual([extra]);
  });

  it('turns a name of the wrong type into an empty name and keeps at least one day', () => {
    expect(loadTrip(saved({ name: 7, days: [] }))).toEqual(createTrip());
  });
});

describe('clearTrip', () => {
  it('removes the saved trip, so the next load starts a fresh one', () => {
    const storage = memoryStorage({ other: 'kept' });
    saveTrip(tripOf([DHAKA]), storage);
    clearTrip(storage);
    expect(storage.data).toEqual({ other: 'kept' });
    expect(loadTrip(storage)).toEqual(createTrip());
  });

  it('never throws, even when storage is missing or throws', () => {
    const blocked = {
      ...throwingStorage,
      removeItem() {
        throw new Error('blocked');
      },
    };
    expect(() => clearTrip(blocked)).not.toThrow();
    expect(() => clearTrip(null)).not.toThrow();
  });
});
