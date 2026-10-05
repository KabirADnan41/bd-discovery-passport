// Only harmless game state is stored: the list of discovered district ids and the best quiz score. Nothing personal.
export const STORAGE_KEY = 'bd-discovery-passport:v1';
export const QUIZ_BEST_KEY = 'bd-discovery-passport:quiz-best';

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

/** Best quiz score (0 to 100), or 0 if none is saved or the saved value is junk. Never throws. */
export function loadQuizBest(storage = getStorage()) {
  try {
    const best = Number(storage?.getItem(QUIZ_BEST_KEY));
    return Number.isInteger(best) && best >= 0 && best <= 100 ? best : 0;
  } catch {
    return 0;
  }
}

export function saveQuizBest(score, storage = getStorage()) {
  try {
    storage?.setItem(QUIZ_BEST_KEY, String(score));
  } catch {
    // quota or privacy errors: the best score just isn't remembered
  }
}

export function clearQuizBest(storage = getStorage()) {
  try {
    storage?.removeItem(QUIZ_BEST_KEY);
  } catch {
    // ignore
  }
}
