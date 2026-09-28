# Architecture

## Overview

```
Build time (your PC or CI)                         Runtime (Cloudflare, 24/7, free plan)
───────────────────────────                        ─────────────────────────────────────
data/source/*.geojson ──► scripts/build-district-map.mjs     Cloudflare Pages (static)
   (pinned by SHA-256)       │  join + ADM2 spatial fix         index.html, privacy/, terms/
                             │  TopoJSON dissolve + simplify    /assets/*.js *.css *.woff2
                             ▼  Transverse Mercator 90°E        _headers (strict CSP)
src/generated/districtPaths.generated.json                    │
scripts/validate-map-data.mjs (runs before every build)       ▼
vite build ─────────────────────────────────────►  Pages Functions  /api/*
                                                     functions/api/*.js → server/*.js
                                                               │  binding: DB
                                                               ▼
                                                       Cloudflare D1 (SQLite)
                                                       users · passports · sessions · rate_limits
```

The browser gets pre-projected SVG path strings. No map library, tiles or GeoJSON processing run in the browser.

## Directory map

| Path | Purpose |
|---|---|
| `scripts/build-district-map.mjs` | ADM3 → 64 districts pipeline (see `docs/data-sources.md`) |
| `scripts/validate-map-data.mjs` | Fails the build on any id, join, geometry or content problem |
| `scripts/measure-performance.mjs` | Lab LCP/CLS/bytes, desktop and Slow 4G phone |
| `src/components/game/GameBoard.jsx` | Page composition, focus management, announcements, sign-in/out flows |
| `src/components/map/` | `BangladeshMap` (SVG, roving tabindex, overlays), `DistrictTooltip`, `MapLegend` |
| `src/components/district/` | `DistrictCard` (passport page / mobile sheet with drag-to-dismiss), `PassportStamp`, `DistrictIndex` (gazetteer) |
| `src/components/account/` | `PassportMenu` (native popover + fallback), `AuthDialog`, `DeleteAccountDialog` |
| `src/components/ui/` | `Modal` (native `<dialog>`), `ConfirmDialog` |
| `src/hooks/useDiscoveryState.js` | Reducer: stamps, selection, and the passport **source** (`pending` / `guest` / `account`) |
| `src/hooks/usePassportSync.js` | Uploads stamps while the source is `account`; epoch + in-flight dedupe; clears the guest copy after a confirmed merge |
| `src/hooks/useAccount.js` | Session check on load, sign-in/up, sign-out, delete |
| `src/hooks/useTheme.js`, `public/theme-init.js` | System / Light / Dark, applied before first paint |
| `src/lib/` | `districtData`, `discoveryStorage` (hardened localStorage), `mapNavigation` (arrow keys), `sheetGesture`, `authClient` (PBKDF2 600k) |
| `shared/credentials.js` | Username rule + base64url, shared by browser and server |
| `server/` | `http.js` (JSON, cookies, body limits), `auth.js` (HMAC verifier, sessions, rate limits, stamps) |
| `functions/api/` | `_middleware` (fail-closed config check, Origin + JSON), `me`, `auth/{signup,login,logout}`, `passport`, `account` |
| `migrations/0001_init.sql` | D1 schema |
| `privacy/`, `terms/` | Static policy pages (no JavaScript) |
| `tests/unit`, `tests/api`, `tests/e2e` | Vitest, API smoke test, Playwright + axe |

## Key flows

**Discovering a district.** Click, tap, Enter or Space on a path (or a gazetteer entry) dispatches `activate(id)`. The
reducer adds the id once and selects it. The card opens (desktop side page or mobile sheet), the stamp plays its impact
(first time only), the newest ledger tick fills after the stamp, and a polite live region announces the count. The URL
becomes `?district=<id>`.

**Where stamps live.** The passport starts `pending`, so nothing is written until `/api/me` answers. Then it becomes:
- `guest`: saved to `localStorage` (`bd-discovery-passport:v1`, ids only);
- `account`: `usePassportSync` uploads new ids with `POST /api/passport` (a union, so retries and two devices are safe).

**Signing in.** The dialog stretches the password in the browser (PBKDF2-SHA256, 600k iterations, salt = SHA-256 of the
normalised username) and sends only the derived key. The server compares `HMAC(pepper, key)` in constant time. Guest stamps
merge only if the box is ticked (pre-ticked on sign-up, unticked on sign-in). The guest copy is removed only after the server
confirms it has them.

## Design system

Tokens in `src/styles/tokens.css` (light + `[data-theme='dark']`); components use semantic roles (`--surface-*`, `--text-*`,
`--map-*`, `--accent-*`). One family: Anek Bangla (wght axis). Shape: pill controls, 12 px surfaces. Motion tokens:
`--ease-out: cubic-bezier(0.23, 1, 0.32, 1)`, `--ease-sheet: cubic-bezier(0.32, 0.72, 0, 1)`. Reduced motion keeps fades and
drops movement. Contrast is enforced by `tests/unit/contrast.test.js`.

## Decisions and alternatives

See `PROGRESS.md` section 4 (approach audit) for each major decision, the alternatives considered, and the verdict.
