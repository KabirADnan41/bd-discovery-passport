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
| `src/components/game/GameBoard.jsx` | Page composition, Explore / Quiz switch, focus management, announcements, sign-in/out flows |
| `src/components/game/QuizPanel.jsx` | Quiz prompt, feedback, score and the round summary |
| `src/components/map/` | `BangladeshMap` (SVG, roving tabindex, overlays), `DistrictTooltip`, `MapLegend` |
| `src/components/district/` | `DistrictCard` (passport page / mobile sheet with drag-to-dismiss, places to go), `PassportStamp`, `DistrictIndex` (gazetteer) |
| `src/components/account/` | `PassportMenu` (native popover + fallback), `AuthDialog`, `DeleteAccountDialog` |
| `src/components/ui/` | `Modal` (native `<dialog>`), `ConfirmDialog` |
| `src/hooks/useDiscoveryState.js` | Reducer: stamps, selection, and the passport **source** (`pending` / `guest` / `account`) |
| `src/hooks/usePassportSync.js` | Uploads stamps while the source is `account`; epoch + in-flight dedupe; clears the guest copy after a confirmed merge |
| `src/hooks/useAccount.js` | Session check on load, sign-in/up, sign-out, delete |
| `src/hooks/useTheme.js`, `public/theme-init.js` | System / Light / Dark, applied before first paint |
| `src/lib/` | `districtData`, `discoveryStorage` (hardened localStorage, quiz best score), `mapNavigation` (arrow keys), `sheetGesture`, `authClient` (PBKDF2 600k), `quiz` (rounds, scoring, hints), `places` (lazy load, Directions URL) |
| `src/data/places.json` | 334 places to go (4 to 6 per district), loaded on demand as a separate chunk |
| `shared/credentials.js` | Username rule + base64url, shared by browser and server |
| `server/` | `http.js` (JSON, cookies, body limits), `auth.js` (HMAC verifier, sessions, rate limits, stamps) |
| `functions/api/` | `_middleware` (method allowlist, per-IP pre-filter, fail-closed config check, Origin + JSON), `me`, `auth/{signup,login,logout}`, `passport`, `account` |
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

**Places to go.** Opening a district card loads `src/data/places.json` once (dynamic import, so it stays out of the main
bundle; a failed load is retried next time). Each place has a Directions link to Google's no-key Maps URL, opened in a new
tab with `rel` noopener; nothing is sent to Google until the user chooses it.

**Quiz.** The Explore / Quiz switch starts a round of 10 random districts. Choosing a district is then a guess: 10, 5 or 2
points on try 1, 2 or 3, then the answer is shown for 0, with a distance and direction hint after a miss. The quiz never adds
stamps or opens passport pages, and it hides tooltips and the gazetteer. The best score is kept in `localStorage`
(`bd-discovery-passport:quiz-best`).

## Design system

Tokens in `src/styles/tokens.css` (light + `[data-theme='dark']`); components use semantic roles (`--surface-*`, `--text-*`,
`--map-*`, `--accent-*`). One family: Anek Bangla (wght axis), with a type scale in `src/styles/index.css` (`text-display`,
`text-h1`, `text-h2`, `text-h3`, `text-eyebrow`). Shape: 8 px controls, 12 px surfaces; only the stamp and the sheet's grab
handle stay round. The passport is a solid green cover band above a paper page. Motion tokens:
`--ease-out: cubic-bezier(0.23, 1, 0.32, 1)`, `--ease-sheet: cubic-bezier(0.32, 0.72, 0, 1)`. Reduced motion keeps fades and
drops movement. Contrast is enforced by `tests/unit/contrast.test.js`.

## Key decisions

| Decision | Chosen | Alternatives considered | Why |
|---|---|---|---|
| Map technology | Inline SVG, paths built at compile time | A tile/map library, Canvas or WebGL | 64 accessible, focusable shapes and no map library to load |
| District geometry | Dissolve ADM3 units by district id | geoBoundaries ADM2 directly | Stable district ids from the source repo; the dissolve exposed 7 upstream errors |
| Orphan polygons | ADM2 point-in-polygon, cross-checked | A manual list; nearest centroid | Agreed with 419 of 426 joins; every disagreement was upstream |
| Map payload | Map JSON bundled into the JavaScript | Prerendering the SVG into `index.html` | Simple today; prerendering may paint the map earlier (measure first) |
| Fonts | Anek Bangla, variable weight axis (~200 KB) | System fonts; glyph subsetting | One family for both scripts; subsetting is the likely next saving |
| Accounts platform | Cloudflare Pages Functions + D1 | Supabase (pauses when idle), Firebase (third-party SDK), two-provider setups, self-hosting | Never sleeps, same origin, and over-limit requests fail instead of billing |
| Sign-in | Username + password, PBKDF2 600k in the browser, HMAC + pepper on the server | Passkeys; Sign in with Google; email magic links | Fits the free plan's CPU limit; passkeys are the recommended next step; no reset without email (stated in the terms) |
| Abuse protection | D1 rate limits + a small in-code firewall | Cloudflare Turnstile; a WAF rule (needs a custom domain) | No third-party request; Turnstile only if spam appears |
| Directions | Google's no-key Maps URL, opened in a new tab | Google Maps Platform APIs (billing); an embedded map (third-party requests, CSP change) | Free, and nothing is sent to Google until the user chooses the link |
| Sessions | HttpOnly cookie, token stored as a hash | JWT in `localStorage` | Safer against XSS |
| Theme without a flash | External `theme-init.js` | Inline script + CSP hash | Keeps the strict CSP |
| Keyboard map access | Roving tabindex, arrow keys and the gazetteer | 64 tab stops | One tab stop into the map |
| Policy pages | Static HTML in the Vite build | React routes; a CMS | Fast, readable without JavaScript, versioned with the code |
| Privacy defaults | Opt-in merge on sign-in; nothing stored on the server for guests | Always merge | Protective defaults on shared devices |
