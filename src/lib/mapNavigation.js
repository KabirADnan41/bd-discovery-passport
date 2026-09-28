const DIRECTIONS = {
  ArrowUp: [0, -1],
  ArrowDown: [0, 1],
  ArrowLeft: [-1, 0],
  ArrowRight: [1, 0],
};

export const isArrowKey = key => key in DIRECTIONS;

/**
 * Nearest district in the arrow's direction, using label points in SVG units.
 * Candidates must lie in the forward half-plane; sideways offset costs twice as much
 * as forward distance, so "up" prefers what is visually above.
 */
export function nextDistrictInDirection(districts, fromId, key) {
  const dir = DIRECTIONS[key];
  const from = districts.find(d => d.id === fromId);
  if (!dir || !from) return null;
  let best = null;
  for (const d of districts) {
    if (d.id === fromId) continue;
    const dx = d.label[0] - from.label[0];
    const dy = d.label[1] - from.label[1];
    const forward = dx * dir[0] + dy * dir[1];
    if (forward <= 0) continue;
    const sideways = Math.abs(dx * dir[1] - dy * dir[0]);
    const score = forward + 2 * sideways;
    if (!best || score < best.score) best = { id: d.id, score };
  }
  return best?.id ?? null;
}
