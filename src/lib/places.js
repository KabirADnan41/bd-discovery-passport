/** Google Maps directions to a place, via Google's public Maps URL (no script, no API key). */
export function directionsUrl(name, address) {
  return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(`${name}, ${address}, Bangladesh`)}`;
}

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
