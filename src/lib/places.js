import CATEGORIES_BN from '../data/categories.bn.json';

export const DIRECTIONS_URL = 'https://www.google.com/maps/dir/?api=1';
export const placeLocation = (name, address) => `${name}, ${address}, Bangladesh`;

/** Google Maps directions to a place, via Google's public Maps URL (no script, no API key). */
export function directionsUrl(name, address) {
  return `${DIRECTIONS_URL}&destination=${encodeURIComponent(placeLocation(name, address))}`;
}

/** The Bengali label for an English place category, or undefined so the label stays English. Own keys only. */
export const categoryBn = category => (Object.hasOwn(CATEGORIES_BN, category) ? CATEGORIES_BN[category] : undefined);

let placesPromise = null;

/** The places data is imported on first use so it stays out of the main bundle. A failed load is retried next time. */
export function loadPlaces() {
  placesPromise ??= import('../data/places.json')
    .then(module => module.default)
    .catch(error => {
      placesPromise = null;
      throw error;
    });
  return placesPromise;
}
