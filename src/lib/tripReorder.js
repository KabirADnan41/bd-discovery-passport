// Pure maths for dragging a trip stop to a new place, kept separate so it can be unit tested (like sheetGesture.js).

/**
 * Where the stop at `from` ({ day, index }) lands if dropped at height `y`, as a `to` for moveStop: the index counts the target
 * day's stops as if the held one had already left. `days` is each day's block and its stop rows, top to bottom, as
 * { top, bottom, rows: [{ top, bottom }] } in the same coordinates as `y`. The stop goes after every row whose middle is above
 * `y`, its own row aside, so anywhere on its own row it stays put. Null when `y` is on no day.
 */
export function dropTarget(days, y, from) {
  const day = days.findIndex(d => y >= d.top && y <= d.bottom);
  if (day < 0) return null;
  const isHeld = i => day === from.day && i === from.index;
  return { day, index: days[day].rows.filter((row, i) => !isHeld(i) && (row.top + row.bottom) / 2 < y).length };
}
