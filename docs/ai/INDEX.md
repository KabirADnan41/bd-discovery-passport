# AI index: Bangladesh Discovery Passport

Read this first, then `docs/ai/CURRENT.md` for the work in progress. Deeper docs: `docs/architecture.md` (flows, design
system), `docs/security.md` (threat model, firewall), `docs/data-sources.md` (map pipeline). History: `PROGRESS.md`
(read section 7 only unless you need the past).

## Where things are

| Question | Answer |
|---|---|
| Identity / auth | Browser: `src/lib/authClient.js` (PBKDF2 600k), `src/hooks/useAccount.js`, `src/components/account/AuthDialog.jsx`. Server: `server/auth.js` (HMAC verifier, `createSession`, `getSession`, `requireSession`), `server/http.js` (`SESSION_COOKIE`, `readCookie`). Username rule shared by both: `shared/credentials.js`. |
| Runtime validation | Handwritten, no Zod yet. Requests: `server/http.js` `readJson` (JSON only, 2 KB cap), `server/auth.js` `readCredentials`, `cleanIds` (`DISTRICT_ID_RE`), `PASSWORD_KEY_RE`. Browser storage: `src/lib/discoveryStorage.js`, `src/lib/trip.js` `loadTrip`. Data: `scripts/validate-map-data.mjs` (runs before every build). |
| Resource / permission / limit / flag keys | No registry yet. Permissions are implicit: every route acts only on the session's own user. Limits are constants: `functions/api/_middleware.js` (`WINDOW_MS`, `MAX_PER_WINDOW`), `server/auth.js` (`GUESS_WINDOW`, `GUESSES_PER_USER_NETWORK`, `GUESSES_PER_USER`, `MAX_SESSIONS_PER_USER`), and inline numbers passed to `withinRateLimit` in `functions/api/auth/signup.js` (5 per hour) and `login.js` (30 per window). Flags: none. Audit: none, by design (privacy). |
| Protected policy | `functions/api/_middleware.js` (method allowlist, per-IP pre-filter, fail-closed config check, Origin + JSON), then each route calls `requireSession`. |
| Services | Not separated yet: `server/auth.js` mixes crypto, sessions, rate limits and stamps (`getDiscovered`, `addStamps`). |
| Repositories / adapters | Not separated yet: D1 `prepare()` calls are in `server/auth.js` and in `functions/api/{account,passport}.js` and `functions/api/auth/*.js`. Schema: `migrations/0001_init.sql`. |
| Routes | `functions/api/**` (Cloudflare Pages Functions): `me`, `passport`, `account`, `auth/{signup,login,logout}`. |
| Client gates / navigation | `src/components/game/GameBoard.jsx` (Explore / Quiz / Plan switch, `?district=` deep link), `src/lib/mapNavigation.js` (arrow keys). No sidebar or page shell. |
| Passport state (client) | `src/hooks/useDiscoveryState.js` (reducer, source `pending` / `guest` / `account`), `src/hooks/usePassportSync.js`. |
| Map data and geometry | Sources `data/source/`, pipeline `scripts/build-district-map.mjs`, output `src/generated/districtPaths.generated.json`, content `src/data/districts.enriched.json`, places `src/data/places.json` (334, lazy-loaded, ids `<districtId>-<slug>`). Accessors: `src/lib/districtData.js`, `src/lib/places.js`. |
| Trip planner (in progress) | Logic: `src/lib/trip.js` (pure functions + localStorage), `tests/unit/trip.test.js`. UI: "Add to trip" in `src/components/district/DistrictCard.jsx`, the planner `src/components/trip/TripPanel.jsx` (Plan mode), trip state and edits in `GameBoard.jsx` (`editTrip`). E2E: `tests/e2e/trip.spec.js`, `tests/e2e/planner.spec.js`. Browser-only by owner decision: no API, no D1. |
| Tests | `tests/unit/*.test.js` (Vitest), `tests/api/smoke.mjs` (needs `npm run dev:full`), `tests/e2e/*.spec.js` (Playwright + axe + CSP, heavy). |

## Checks (cheapest first)

`npm run lint` → `npx vitest run <file>` → `npm test` → `npm run validate:data` → `npm run build` → `npx playwright test`
(heavy: one at a time on this PC). There is no typecheck yet: the project is JavaScript.

## Do not read in full

`src/data/places.json`, `src/generated/districtPaths.generated.json`, `package-lock.json`, `PROGRESS.md` (use section 7),
`skill_review.md`. Query them by key or `rg` instead.
