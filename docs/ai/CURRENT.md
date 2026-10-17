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
- **Next step:** the Add-to-trip UI slice (implementation agent, test first, then main-session review). Per-slice agent
  pattern: `PROGRESS.md` section 7.
  - Review findings path: verify each against the code → reject briefly if not real → else reproduce with a test, smallest
    fix, focused tests, then lint + unit + data + build, local commit.
  - Add-to-trip spec: one control per place; short visible label ("Add to trip" / "In your trip") with a full accessible
    name ("Add Star Mosque to trip" / "Star Mosque is in your trip"); localStorage written only after actual use; one
    privacy-notice row for `bd-discovery-passport:trip:v1`; one E2E test (add → reload → still present). Keep it apart from
    route planning, sharing, PDF and the TypeScript work. Checkpoint commit when green; a reviewer only if a real
    state/persistence edge case shows up.
- **Blockers / owner decisions:** local checkpoint commits (the project memory says ask first; the new global CLAUDE.md
  allows them); a new Gemini key in `GEMINI_API_KEY` before Phase 0b (Bengali notes).
- **Standing rules:** trips stay browser-only; no push, deploy or publish without the owner's yes; free tier only; no
  Firecrawl until the owner says the credits renewed.
