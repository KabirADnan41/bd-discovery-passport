# Current work

Only the current state lives here; the history is in `PROGRESS.md` section 7.

- **Branch:** `feat/trip-drag-reorder`, branched from `feat/trip-map` @ `e2c2ae5` (which is on GitHub, verified, CI green).
  Not pushed; ask the owner before pushing. Nothing merged; `main` and the live site are still v2 (`10df59c`).
- **Objective:** roadmap step 3, drag to reorder stops in the planner by reusing `moveStop()` unchanged. Move up / Move down
  stay the keyboard baseline; the drag handle is pointer-only (`aria-hidden`, not focusable). A pure helper
  (`src/lib/tripReorder.js`, unit-tested) turns pointer position into moveStop's `{ day, index }`. A drop announces the
  same "Moved …" message as the Move buttons and does not move focus. No auto-scroll during a drag (documented limitation).
- **Agent pattern:** one implementation agent (in progress), then main-session diff review, the checks one at a time,
  browser interaction checks (desktop + phone, light + dark), then a local commit.
- **Relevant files:** `src/components/trip/TripPanel.jsx`, `src/lib/tripReorder.js` (new), `tests/unit/tripReorder.test.js`
  (new), `src/styles/index.css` (drag rules), `tests/e2e/trip-drag.spec.js` (new). Read-only: `src/lib/trip.js`,
  `src/components/game/GameBoard.jsx`.
- **Environment:** if `accounts.spec.js` fails with "no such table", run `npm run db:migrate:local`.
- **Blockers:** none. A new Gemini key (`GEMINI_API_KEY`) is needed only for the optional Bengali notes.
- **Standing rules:** trips stay browser-only; local commits on feature branches are fine; push, PR, merge to `main`, tag,
  release and deploy need the owner's yes; free tier only; no Firecrawl until the owner says the credits renewed.
