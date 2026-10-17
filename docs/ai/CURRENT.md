# Current work

- **Branch:** `feat/trip-planner` (local, created 2026-10-17 from `main` to hold the uncommitted trip-planner work; nothing
  committed or pushed yet).
- **Objective:** Trip planner Phase 1. The logic is done (`src/lib/trip.js`, 57 tests); the UI is next. Plan and decisions:
  `PROGRESS.md` section 7.
- **Relevant files:** `src/lib/trip.js`, `tests/unit/trip.test.js`, `src/lib/places.js`, `src/lib/discoveryStorage.js`,
  `src/components/district/DistrictCard.jsx`, `src/components/game/GameBoard.jsx`, `src/components/map/BangladeshMap.jsx`.
- **Checks (2026-10-17):** lint clean (`brag-output/` now ignored by ESLint and git), unit 157/157, `validate:data` OK,
  build OK. E2E not run since v2 (no visible change yet).
- **Next step:** code review of the trip-logic diff (Fable, review only), then UI slice 1: an "Add to trip" control on a
  place in `DistrictCard`, with an E2E test.
- **Blockers / owner decisions:** local checkpoint commits (the project memory says ask first; the new global CLAUDE.md
  allows them); a new Gemini key in `GEMINI_API_KEY` before Phase 0b (Bengali notes).
- **Standing rules:** trips stay browser-only; no push, deploy or publish without the owner's yes; free tier only; no
  Firecrawl until the owner says the credits renewed.
