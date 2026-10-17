// Share a trip by link: format v1. Browser-only: no server, no database, no short-link service.
//
// The `trip` query parameter holds the trip's ids and nothing else (no names or labels, which always come from the local
// place data): days joined by "_", each day's stops joined by ".". A stop is a place id ("54-bichanakandi") or a district
// id ("54"); an empty day is an empty segment ("1-star-mosque__54" is day 1, an empty day 2, then day 3). Only lowercase
// letters, digits, "-", "." and "_" appear, so a link needs no escaping, and the same trip always gives the same link.
//
// A link is untrusted input. decodeTripShare validates ALL of it before anything is used and rejects the whole link at the
// first problem, checked in this order:
//   'missing'        not a string, or empty
//   'too-long'       longer than MAX_SHARE_LENGTH (checked before looking inside)
//   'bad-characters' any character outside [a-z0-9._-]
//   'too-many-days'  more than MAX_DAYS days
//   'too-many-stops' more than MAX_STOPS_PER_DAY stops in a day
//   'bad-stop'       an empty or malformed stop, an unknown district, or a stop id longer than MAX_TOKEN_LENGTH
//   'unknown-place'  a well-formed place id that is not in `knownPlaceIds`
//   'duplicate'      the same stop twice anywhere in the trip
//   'no-stops'       days but no stops at all
// Contract: tests/unit/tripShare.test.js.
import { MAX_DAYS, MAX_STOPS_PER_DAY } from './trip';

export const SHARE_PARAM = 'trip';
export const MAX_TOKEN_LENGTH = 64; // the longest place id today is 62 characters
export const MAX_SHARE_LENGTH = MAX_DAYS * MAX_STOPS_PER_DAY * (MAX_TOKEN_LENGTH + 1);

/** The `trip` parameter value for a trip (ids only). */
export function encodeTripShare(trip) {
  throw new Error(`encodeTripShare is not implemented yet (${trip ? 'trip given' : 'no trip'})`);
}

/**
 * Reads a shared `trip` value. Returns { ok: true, trip } with a fresh trip ({ name: '', days }) or { ok: false, reason }
 * (see the reasons above). Never throws. `knownPlaceIds` is a Set of every place id in the local place data.
 */
export function decodeTripShare(value, knownPlaceIds) {
  throw new Error(`decodeTripShare is not implemented yet (${typeof value}, ${knownPlaceIds ? 'ids given' : 'no ids'})`);
}
