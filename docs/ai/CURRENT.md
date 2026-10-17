# Current work

Only the current state lives here; the history is in `PROGRESS.md` section 7.

- **Branch:** `feat/trip-planner` (local, 11 commits ahead of `main` after this docs commit; nothing pushed or merged).
- **Objective:** finish the trip planner, one verified slice at a time (owner's 8-step roadmap, `PROGRESS.md` §7).
  Done: place ids, trip logic, "Add to trip" on places, the planner screen (Plan mode, `b944637`).
- **Relevant files:** `src/lib/trip.js`, `src/components/trip/TripPanel.jsx`, `src/components/game/GameBoard.jsx`
  (`editTrip`), `src/components/district/DistrictCard.jsx`, `src/components/map/BangladeshMap.jsx` (next slice),
  `tests/unit/trip.test.js`, `tests/e2e/trip.spec.js`, `tests/e2e/planner.spec.js`.
- **Checks (2026-10-17, after `b944637`):** lint clean; unit 161/161; `validate:data` OK; build OK; full Playwright suite
  on desktop + mobile with 1 worker: green (90 passed; `accounts.spec.js` 4 passed after re-creating the local D1;
  skips are by design).
- **Next step:** roadmap step 2, map pins for the stops and a route line derived from the trip (needs the owner's go).
- **Open product call:** on phones the planner sits above the map, so a long trip pushes the map down. Recommendation: keep
  it, and add a "Show on map" link with the pins in step 2.
- **Notes for later (not bugs):** "In your trip" looks like "Add to trip" apart from its label (polish slice); phone
  browsers may honour only 3 Maps waypoints (browser QA); a trip stored as all-empty days before `b944637` would still load
  with empty days (no such data exists in production); optional test ideas from the trip-logic review.
- **Environment:** if `accounts.spec.js` fails with "no such table", run `npm run db:migrate:local` (the local D1 was
  recreated on 2026-10-17).
- **Blockers:** none for step 2. A new Gemini key (`GEMINI_API_KEY`) is needed only for the optional Bengali notes.
- **Standing rules:** trips stay browser-only; local commits on this branch are fine; no push, PR, merge to `main`, tag,
  release or deploy without the owner's yes; free tier only; no Firecrawl until the owner says the credits renewed.
