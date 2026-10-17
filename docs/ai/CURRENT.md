# Current work

Only the current state lives here; the history is in `PROGRESS.md` section 7.

- **Branch:** `feat/trip-drag-reorder`, branched from `feat/trip-map` @ `e2c2ae5` (on GitHub, verified, CI green). Local
  only: waiting for the owner's yes to push. Nothing merged; `main` and the live site are still v2 (`10df59c`).
- **Objective:** roadmap step 3, drag to reorder. **Done and verified** (`a4a4979`, `PROGRESS.md` #59).
- **Checks (2026-10-17, main session):** lint exit 0; Vitest 180/180; build OK; `trip-drag.spec.js` 14 passed + 2 by-design
  skips (real touch through CDP on mobile); planner + trip-map on both projects 44 passed + 4 known skips; trip +
  accessibility + discovery on desktop 29/29; visual check desktop + phone, light + dark.
- **Next step (owner's choice):** push this branch; then roadmap step 4, share by link (`?trip=…`), on its own branch with
  a reviewer for the untrusted URL data.
- **Relevant files:** `src/components/trip/TripPanel.jsx` (`useStopDrag`, `movedMessage`), `src/lib/tripReorder.js`
  (`dropTarget`), `src/styles/index.css` (`.trip-grip`, `.trip-stop`, `.trip-day`), `tests/unit/tripReorder.test.js`,
  `tests/e2e/trip-drag.spec.js`.
- **Known limits:** no auto-scroll while dragging (Move buttons for long moves); only Chromium tested (no Safari, Firefox or
  real iOS); the dark-mode lifted card is subtle.
- **Environment:** if `accounts.spec.js` fails with "no such table", run `npm run db:migrate:local`.
- **Standing rules:** trips stay browser-only; local commits on feature branches are fine; push, PR, merge to `main`, tag,
  release and deploy need the owner's yes; free tier only; no Firecrawl until the owner says the credits renewed.
