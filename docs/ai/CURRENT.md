# Current work

Only the current state lives here; the history is in `PROGRESS.md` section 7.

- **Branch:** `feat/trip-map`, branched from `feat/trip-planner` (`341b678`). GitHub has `2898e2a` (CI green). The local
  docs commit recording the verification is not pushed yet. Nothing merged; `main` and the live site are still v2
  (`10df59c`).
- **Objective:** roadmap step 2, map pins for the stops' districts and an approximate route line per day (spec:
  `PROGRESS.md` #57). **Done and verified on 2026-10-17 with no fixes needed (#58). Ready for the owner's review.**
- **Checks (2026-10-17 evening):** lint exit 0; Vitest 171/171; build OK; `trip-map.spec.js` 13 passed + 3 by-design skips;
  desktop planner + discovery + accessibility + quiz 41/41; mobile planner + discovery 23 passed + 4 by-design skips;
  `trip.spec.js` 12/12; visual check desktop + phone, light + dark.
- **Next step (owner's choice):** push the docs commit; then roadmap step 3 (drag to reorder, reusing `moveStop()`) on its
  own branch per the branch plan.
- **Relevant files for the map:** `src/lib/trip.js` (`tripMapData`), `src/components/map/BangladeshMap.jsx` (`tripMap`
  overlay), `src/components/map/MapLegend.jsx` (`mode`), `src/components/game/GameBoard.jsx`,
  `src/components/trip/TripPanel.jsx`, `src/styles/index.css` (`.trip-overlay`), `tests/e2e/trip-map.spec.js`.
- **Environment:** if `accounts.spec.js` fails with "no such table", run `npm run db:migrate:local`.
- **Blockers:** none. A new Gemini key (`GEMINI_API_KEY`) is needed only for the optional Bengali notes.
- **Standing rules:** trips stay browser-only; local commits on feature branches are fine; push, PR, merge to `main`, tag,
  release and deploy need the owner's yes; free tier only; no Firecrawl until the owner says the credits renewed.
