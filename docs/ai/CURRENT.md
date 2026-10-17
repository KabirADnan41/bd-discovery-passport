# Current work

Only the current state lives here; the history is in `PROGRESS.md` section 7.

- **Branch:** `feat/trip-map`, branched from `feat/trip-planner` (`341b678`). Both branches were pushed to GitHub on
  2026-10-17 at the owner's request (backup). Nothing is merged; `main` and the live site are still v2 (`10df59c`).
- **Objective:** roadmap step 2, map pins for the stops' districts and an approximate route line per day (spec: `PROGRESS.md`
  #57).
- **State:** the implementation is saved as an **unverified** `wip(trip-map)` commit. The agent was stopped at the session
  close just before its final checks.
- **Next step:** follow "Resume the map slice" in `PROGRESS.md` §7. Review the wip diff (BangladeshMap must only gain the
  non-interactive overlay group), run the checks one at a time, fix from diagnostics, commit on top. Never force-push or push
  without the owner's yes.
- **Relevant files:** `src/lib/trip.js` (`tripMapData`), `src/components/map/BangladeshMap.jsx`,
  `src/components/map/MapLegend.jsx`, `src/components/game/GameBoard.jsx`, `src/components/trip/TripPanel.jsx`,
  `src/styles/index.css` (`.trip-overlay`), `tests/unit/trip.test.js`, `tests/e2e/trip-map.spec.js`.
- **Last full verification:** `b944637` on `feat/trip-planner`: lint, unit 161/161, build, full Playwright suite green.
- **Environment:** if `accounts.spec.js` fails with "no such table", run `npm run db:migrate:local`.
- **Blockers:** none. A new Gemini key (`GEMINI_API_KEY`) is needed only for the optional Bengali notes.
- **Standing rules:** trips stay browser-only; local commits on feature branches are fine; push, PR, merge to `main`, tag,
  release and deploy need the owner's yes; free tier only; no Firecrawl until the owner says the credits renewed.
