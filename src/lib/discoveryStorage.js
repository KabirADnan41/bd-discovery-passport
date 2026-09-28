// Only harmless game state is stored: the list of discovered district ids. Nothing personal.
export const STORAGE_KEY = 'bd-discovery-passport:v1';

function getStorage() {
  try {
    return window.localStorage;
  } catch {
    return null; // blocked storage (privacy mode, sandboxed iframe)
  }
}

/** Read saved ids, keeping only known district ids, without duplicates. Never throws. */
export function loadDiscovered(validIds, storage = getStorage()) {
  if (!storage) return [];
  try {
    const parsed = JSON.parse(storage.getItem(STORAGE_KEY) ?? 'null');
    const list = Array.isArray(parsed?.discovered) ? parsed.discovered : [];
    return [...new Set(list.filter(id => typeof id === 'string' && validIds.has(id)))];
  } catch {
    return [];
  }
}

export function saveDiscovered(ids, storage = getStorage()) {
  try {
    storage?.setItem(STORAGE_KEY, JSON.stringify({ discovered: ids }));
  } catch {
    // quota or privacy errors: the game keeps working for this visit
  }
}

export function clearDiscovered(storage = getStorage()) {
  try {
    storage?.removeItem(STORAGE_KEY);
  } catch {
    // ignore
  }
}
