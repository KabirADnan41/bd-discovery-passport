# Current work

- **Branch:** `feat/trip-planner` (local, created 2026-10-17 from `main` to hold the uncommitted trip-planner work; nothing
  committed or pushed yet).
- **Objective:** Trip planner Phase 1. The logic is done (`src/lib/trip.js`, 57 tests); the UI is next. Plan and decisions:
  `PROGRESS.md` section 7.
- **Relevant files:** `src/lib/trip.js`, `tests/unit/trip.test.js`, `src/lib/places.js`, `src/lib/discoveryStorage.js`,
  `src/components/district/DistrictCard.jsx`, `src/components/game/GameBoard.jsx`, `src/components/map/BangladeshMap.jsx`.
- **Checks (2026-10-17):** lint clean (`brag-output/` now ignored by ESLint and git), unit 159/159, `validate:data` OK,
  build OK. E2E not run since v2 (no visible change yet).
- **Trip-logic review (Fable, 2026-10-17): APPROVE.** Fixed: MEDIUM (an array place id passed validation and later crashed
  `districtOf`) and LOW (a `|` in a location split the waypoints), each with a failing test first. Not done (optional test
  ideas, no current risk): "loadTrip limits count only kept stops" and a load → save → load fixpoint test. For browser QA
  later: Google may honour only 3 waypoints in a phone browser; on most phones the link opens the Maps app instead.
- **Done 2026-10-17: "Add to trip" on places.** One button per place (not landmarks or culture), visible "Add to trip" /
  "In your trip", accessible name `Add to trip: {place}` / `In your trip: {place}` (WCAG 2.5.3: the visible words come
  first). Saved only after the first add; a full last day starts a new day; a full trip says "Your trip is full.".
  Privacy notice: new storage row and intro line. Checks: lint, unit 159/159, build, `trip.spec.js` 12/12 (desktop +
  mobile), discovery + accessibility 21/21 (desktop).
  - Noted for later, not bugs: "In your trip" looks like "Add to trip" apart from its label (polish slice); "Reset passport"
    does not clear the trip (the planner screen gets its own clear); the button shows only for places with an address
    (all 334 have one).
- **In progress: the planner screen** (owner's go, 2026-10-17). A third mode, Explore / Quiz / Plan (পরিকল্পনা), swaps
  the side panel to `src/components/trip/TripPanel.jsx`, the way Quiz swaps in `QuizPanel`. Scope: days and stops, up/down
  (crossing days), remove, add a day, remove an empty day, one Directions link per day, empty state, "Clear trip" (confirm,
  then `clearTrip()` removes the storage key). Stale stops are pruned only inside the planner. Out of scope: pins, route
  line, drag, sharing, suggestions, distances, PDF. Agent pattern: implementation agent (Opus), then a focused reviewer
  for the trip-state integration, then main-session verification and a local commit. Full roadmap: `PROGRESS.md` §7.
- **Blockers / owner decisions:** a new Gemini key in `GEMINI_API_KEY` before Phase 0b (Bengali notes). Local checkpoint
  commits on this branch are approved (17 Oct 2026).
- **Standing rules:** trips stay browser-only; no push, deploy or publish without the owner's yes; free tier only; no
  Firecrawl until the owner says the credits renewed.
