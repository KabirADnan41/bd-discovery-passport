// Pure maths for the mobile sheet's drag-to-dismiss, kept separate so it can be unit tested.

export const DISMISS_VELOCITY = 0.11; // px per ms: a quick flick dismisses regardless of distance
export const DISMISS_FRACTION = 0.3; // or dragging past 30% of the sheet's height

/** Downward drag moves 1:1; upward drag meets increasing friction instead of a hard stop. */
export function dampedOffset(dy) {
  return dy >= 0 ? dy : -Math.sqrt(-dy) * 2.5;
}

export function shouldDismiss({ dy, elapsedMs, sheetHeight }) {
  if (dy <= 0) return false;
  const velocity = dy / Math.max(elapsedMs, 1);
  return velocity > DISMISS_VELOCITY || dy > sheetHeight * DISMISS_FRACTION;
}
