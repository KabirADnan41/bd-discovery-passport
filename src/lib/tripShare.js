// Share a trip by link: format v1. Browser-only: no server, no database, no short-link service.
//
// The `trip` query parameter holds the trip's ids and nothing else (no names or labels, which always come from the local
// place data): days joined by "_", each day's stops joined by ".". A stop is a place id ("54-bichanakandi") or a district
// id ("54"). Empty days carry nothing to share, so they are left out ("1-star-mosque_54" is two days of one stop each).
// Only lowercase letters, digits, "-", "." and "_" appear, so a link needs no escaping, and the same trip always gives the
// same link. MAX_SHARE_LENGTH is a safety limit of the format, not a promise that every messaging app handles links that long.
//
// A link is untrusted input. decodeTripShare validates ALL of it before anything is used and rejects the whole link at the
// first problem, checked in this order:
//   'missing'        not a string, or empty
//   'too-long'       longer than MAX_SHARE_LENGTH (checked before looking inside)
//   'bad-characters' any character outside [a-z0-9._-]
//   'too-many-days'  more than MAX_DAYS days
//   'empty-day'      an empty day: "_" at the start or end, "__", or "_" alone
//   'too-many-stops' more than MAX_STOPS_PER_DAY stops in a day
//   'bad-stop'       an empty or malformed stop, an unknown district, or a stop id longer than MAX_TOKEN_LENGTH
//   'unknown-place'  a well-formed place id that is not in `knownPlaceIds`
//   'duplicate'      the same stop twice anywhere in the trip
// Contract: tests/unit/tripShare.test.js.
import { DISTRICT_IDS } from './districtData';
import { MAX_DAYS, MAX_STOPS_PER_DAY, PLACE_ID } from './trip';

export const SHARE_PARAM = 'trip';
export const MAX_TOKEN_LENGTH = 64; // the longest place id today is 62 characters
export const MAX_SHARE_LENGTH = MAX_DAYS * MAX_STOPS_PER_DAY * (MAX_TOKEN_LENGTH + 1);

const ALLOWED = /^[a-z0-9._-]+$/;

/** 'district', 'place' or null (malformed, unknown district, or too long). A place's existence is checked separately. */
function kindOf(id) {
  if (DISTRICT_IDS.has(id)) return 'district';
  return id.length <= MAX_TOKEN_LENGTH && DISTRICT_IDS.has(PLACE_ID.exec(id)?.[1]) ? 'place' : null;
}

const reject = reason => ({ ok: false, reason });

/** The `trip` parameter value for a trip (ids only). */
export function encodeTripShare(trip) {
  return trip.days
    .filter(day => day.length > 0)
    .map(day => day.map(stop => stop.id).join('.'))
    .join('_');
}

/**
 * Reads a shared `trip` value. Returns { ok: true, trip } with a fresh trip ({ name: '', days }) or { ok: false, reason }
 * (see the reasons above). Never throws. `knownPlaceIds` is a Set of every place id in the local place data.
 */
export function decodeTripShare(value, knownPlaceIds) {
  if (typeof value !== 'string' || !value) return reject('missing');
  if (value.length > MAX_SHARE_LENGTH) return reject('too-long');
  if (!ALLOWED.test(value)) return reject('bad-characters');
  const segments = value.split('_');
  if (segments.length > MAX_DAYS) return reject('too-many-days');
  if (segments.includes('')) return reject('empty-day');
  const dayIds = segments.map(segment => segment.split('.'));
  if (dayIds.some(ids => ids.length > MAX_STOPS_PER_DAY)) return reject('too-many-stops');
  const days = dayIds.map(ids => ids.map(id => ({ kind: kindOf(id), id })));
  const stops = days.flat();
  if (stops.some(stop => !stop.kind)) return reject('bad-stop');
  const isKnown = id => knownPlaceIds instanceof Set && knownPlaceIds.has(id);
  if (stops.some(stop => stop.kind === 'place' && !isKnown(stop.id))) return reject('unknown-place');
  if (new Set(stops.map(stop => stop.id)).size < stops.length) return reject('duplicate'); // an id alone fixes its kind
  return { ok: true, trip: { name: '', days } };
}
