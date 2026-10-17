import { TRIP_KEY, getStorage } from './discoveryStorage';
import { DISTRICT_IDS, getDistrict } from './districtData';
import { DIRECTIONS_URL, placeLocation } from './places';
import { distanceKm } from './quiz';

// A trip is { name, days }: each day is a list of stops, and a stop is { kind: 'place' | 'district', id }.
// Changes return a new trip; a refused change returns the same trip. Place data is passed in, never imported,
// so places.json stays out of the main bundle.
export const MAX_DAYS = 10;
export const MAX_STOPS_PER_DAY = 10; // so a day's Maps link has at most 8 waypoints
export const MAX_NAME_LENGTH = 60;

const PLACE_ID = /^(\d+)-[a-z0-9]+(?:-[a-z0-9]+)*$/; // "<districtId>-<slug>", e.g. "54-shah-jalal-dargah"

const isValidStop = stop =>
  typeof stop?.id === 'string' && // RegExp#exec would turn ['1-x'] into '1-x' and let an array through
  ((stop.kind === 'district' && DISTRICT_IDS.has(stop.id)) || (stop.kind === 'place' && DISTRICT_IDS.has(PLACE_ID.exec(stop.id)?.[1])));
const districtOf = stop => getDistrict(stop.kind === 'place' ? stop.id.split('-')[0] : stop.id);
const isIndex = (list, index) => Number.isInteger(index) && index >= 0 && index < list.length;
const withDay = (trip, index, day) => ({ ...trip, days: trip.days.map((d, i) => (i === index ? day : d)) });
const cleanName = name => name.trim().slice(0, MAX_NAME_LENGTH);

export const createTrip = () => ({ name: '', days: [[]] });

export const hasStop = (trip, stop) => trip.days.some(day => day.some(s => s.kind === stop.kind && s.id === stop.id));

/** Adds a stop at the end of a day (the last day by default). Refuses an invalid stop, one already in the trip, or a full day. */
export function addStop(trip, stop, dayIndex = trip.days.length - 1) {
  const day = trip.days[dayIndex];
  if (!isIndex(trip.days, dayIndex) || !isValidStop(stop) || hasStop(trip, stop) || day.length >= MAX_STOPS_PER_DAY) return trip;
  return withDay(trip, dayIndex, [...day, { kind: stop.kind, id: stop.id }]);
}

export function removeStop(trip, dayIndex, stopIndex) {
  const day = trip.days[dayIndex];
  if (!isIndex(trip.days, dayIndex) || !isIndex(day, stopIndex)) return trip;
  return withDay(trip, dayIndex, day.filter((_, i) => i !== stopIndex));
}

/** Moves the stop at `from` ({ day, index }) so it ends up at `to` ({ day, index }). Refuses a move into another day that is full. */
export function moveStop(trip, from, to) {
  if (!isIndex(trip.days, from.day) || !isIndex(trip.days, to.day) || !isIndex(trip.days[from.day], from.index)) return trip;
  const sameDay = from.day === to.day;
  const rest = trip.days[from.day].filter((_, i) => i !== from.index);
  const target = sameDay ? rest : trip.days[to.day];
  const fits = isIndex(target, to.index) || to.index === target.length;
  if (!fits || (!sameDay && target.length >= MAX_STOPS_PER_DAY)) return trip;
  const moved = [...target.slice(0, to.index), trip.days[from.day][from.index], ...target.slice(to.index)];
  return { ...trip, days: trip.days.map((day, i) => (i === to.day ? moved : i === from.day ? rest : day)) };
}

export const addDay = trip => (trip.days.length < MAX_DAYS ? { ...trip, days: [...trip.days, []] } : trip);

/** Removes a day and its stops, always keeping at least one day. */
export function removeDay(trip, dayIndex) {
  if (!isIndex(trip.days, dayIndex)) return trip;
  const days = trip.days.filter((_, i) => i !== dayIndex);
  return { ...trip, days: days.length ? days : [[]] };
}

/** Sets the name, trimmed and cut to MAX_NAME_LENGTH characters. */
export const renameTrip = (trip, name) => ({ ...trip, name: cleanName(name) });

/** Drops place stops whose ids are not in `knownPlaceIds` (a Set), for use once places.json has loaded. */
export const pruneUnknownPlaces = (trip, knownPlaceIds) => ({
  ...trip,
  days: trip.days.map(day => day.filter(stop => stop.kind !== 'place' || knownPlaceIds.has(stop.id))),
});

/**
 * Where Google Maps should go for a stop: a place in `placesById` (a Map) as "<name.en>, <address>, Bangladesh",
 * like the Directions link; a district, or a place that is not loaded, as its district town's "<lat>,<lon>".
 */
export function locationOf(stop, placesById = new Map()) {
  const place = stop.kind === 'place' && placesById.get(stop.id);
  if (place) return placeLocation(place.name.en, place.address);
  const town = districtOf(stop);
  return `${town.lat},${town.lon}`;
}

/**
 * A Google Maps link for one day, from the first stop to the last through the others in order. One stop is a
 * destination only, so Maps starts from where the user is. Null for an empty day. `locate(stop)` gives each location.
 */
export function dayDirectionsUrl(stops, locate) {
  if (!stops.length) return null;
  const [origin, ...rest] = stops.map(stop => encodeURIComponent(locate(stop).replaceAll('|', ' '))); // Maps splits waypoints on |
  if (!rest.length) return `${DIRECTIONS_URL}&destination=${origin}`;
  const waypoints = rest.length > 1 ? `&waypoints=${rest.slice(0, -1).join('%7C')}` : ''; // %7C is "|"
  return `${DIRECTIONS_URL}&origin=${origin}&destination=${rest.at(-1)}${waypoints}`;
}

/** Straight-line km between consecutive stops' district towns, rounded to 10 km like the quiz hint (0 within a district). */
export function legDistancesKm(stops) {
  const towns = stops.map(districtOf);
  return towns.slice(1).map((town, i) => distanceKm(towns[i], town));
}

/**
 * What the map draws for a trip, by district only: `pins` has one { districtId, count } per district with stops (count = how many
 * stops), in order of first appearance; `routes` has one list per day of its districts in stop order, with repeats in a row
 * collapsed. Days are never joined, and a route needs two districts to be drawn.
 */
export function tripMapData(trip) {
  const counts = new Map();
  const routes = trip.days.map(day => {
    const ids = day.map(stop => districtOf(stop).id);
    ids.forEach(id => counts.set(id, (counts.get(id) ?? 0) + 1));
    return ids.filter((id, i) => id !== ids[i - 1]);
  });
  return { pins: [...counts].map(([districtId, count]) => ({ districtId, count })), routes };
}

/** The saved trip, keeping only valid stops within the limits, or a new trip. Never throws. */
export function loadTrip(storage = getStorage()) {
  try {
    const saved = JSON.parse(storage?.getItem(TRIP_KEY) ?? 'null');
    if (!Array.isArray(saved?.days)) return createTrip();
    const days = saved.days.filter(Array.isArray).slice(0, MAX_DAYS);
    let trip = { name: typeof saved.name === 'string' ? cleanName(saved.name) : '', days: days.length ? days.map(() => []) : [[]] };
    days.forEach((day, i) => day.forEach(stop => (trip = addStop(trip, stop, i))));
    return trip;
  } catch {
    return createTrip();
  }
}

export function saveTrip(trip, storage = getStorage()) {
  try {
    storage?.setItem(TRIP_KEY, JSON.stringify(trip));
  } catch {
    // quota or privacy errors: the plan lasts for this visit only
  }
}

/** Forgets the saved trip ("Clear trip" in the planner). Never throws. */
export function clearTrip(storage = getStorage()) {
  try {
    storage?.removeItem(TRIP_KEY);
  } catch {
    // ignore
  }
}
