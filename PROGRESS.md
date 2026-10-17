# Bangladesh Discovery Passport: progress log

> **Resuming in a new session?** Tell Claude: *"Read PROGRESS.md and continue."*
> This file is the handoff: what is done, which skill and approach each task used, what is left and with which
> skills, the approach audit, and how to run everything. Updated at every milestone.

**Last updated:** 2026-10-17 22:30 (UTC+6), milestone 35: the **map slice on `feat/trip-map` is verified** with no fixes
needed (#58, section 7 "State after the map verification") and is **ready for the owner's review**. The verification commit
`e2c2ae5` was pushed with the owner's yes. Slice 3 (drag to reorder) started on `feat/trip-drag-reorder`, branched from
`feat/trip-map`. Nothing merged or deployed.
Previous: milestone 34 (2026-10-17 17:36): the **trip-planner foundation is done** on the local branch
`feat/trip-planner` (12 commits, reviewed and fully tested: place ids, trip logic, "Add to trip", the Plan-mode planner screen)
and was **pushed to GitHub as a branch on 2026-10-17 at the owner's request** (backup; not merged). The map slice (pins +
district-level route) was mid-way on `feat/trip-map` when the session closed: its changes are saved as an **unverified WIP
commit**, and that branch was pushed too. **Resume at section 7, "State at the 2026-10-17 close".** Nothing merged or
deployed: GitHub `main` and the live site are still v2 (`10df59c`).
Previous: milestone 33 (2026-10-06): launch video made (`brag-output/brag.mp4`, local only, #52); trip planner planned; place ids
and trip logic built.
Earlier: milestone 32 (2026-10-05), **v2 round LIVE** (quiz mode, places to go with Directions links, free-plan
firewall, redesign). Leak scan passed with notes; commit `10df59c` pushed to `main` and deployed to
https://bd-discovery-passport.pages.dev. Live check: new bundle served, PUT on the API returns 405, 0 console errors, places
with Directions links and the quiz work.
Earlier: milestone 29 (2026-09-28), **LIVE at https://bd-discovery-passport.pages.dev**, production verified (headers, API smoke
test, real browser with 0 CSP violations and 0 errors, LCP 520 ms desktop / 2.45 s Slow-4G phone), pushed to github.com/KabirADnan41/bd-discovery-passport (**public**).

Skill status words (from the brief): **APPLIED** (actually used and changed the work), **AVAILABLE** (installed, not yet
used), **NOT NEEDED** (considered, deliberately skipped, with reason), **UNAVAILABLE** (cannot be used in this session).

**Rough completion of the v2 round: about 98%.** Everything is built, reviewed, tested, pushed and live; only optional work is left. (v1 reached about 97% at milestone 29:
live, only optional work left.)

---

## 1. Overall status

| Area | State |
|---|---|
| Phase 0: device skill scan, dedupe, global install, project skills | DONE |
| Phase 0B: MCP / plugin audit | DONE (write-up in docs/project-skills.md) |
| Phase 0C: reference books (5 original + *Privacy's Blueprint*, added by the user) | DONE (notes in docs/security.md section 8) |
| Geographic pipeline (64 districts from ADM3) | DONE, validated |
| Verified district content | DONE (8 districts) |
| Core UI (map, passport card, stamp, progress, gazetteer) | DONE, browser-checked at 5 widths, light + dark |
| Light / dark theme with toggle (user request) | DONE: System / Light / Dark in the menu, no flash on reload, instant switch |
| User accounts on free 24/7 hosting (user request) | DONE: API 24/24 checks, browser flow passes |
| Hosting question (user request: 24/7 without your PC) | ANSWERED: Cloudflare Pages + Functions + D1, nothing runs on your PC after deploy |
| Visual fixes from the first browser pass | DONE (mobile masthead, legend placement, stamp ink, sheet auto-scroll) |
| Motion (Stages G, H, I) | DONE: browser-verified in normal and reduced motion |
| Accessibility guideline audit (Stage K) | DONE for source review; axe scans run in the new test suite |
| Privacy notice + terms + map disclaimer (user request) | DONE: `/privacy/` and `/terms/`, static HTML, linked from every page and the sign-up form |
| Security headers / CSP | DONE: `public/_headers`, verified served by `wrangler pages dev` |
| Permanent tests (unit + E2E + axe + CSP) | DONE: 37 E2E (desktop + Pixel 7), 55 unit, axe in both themes, CSP on every test |
| ESLint | DONE: clean |
| Performance (Stage N) | DONE: measured, targets met, no optimisation needed |
| Code review (Stage R) | DONE: 10 findings fixed |
| Security review (Stage Q) | DONE (manual; the built-in skill needs a git remote): 3 low-severity fixes, all verified |
| Simplify (Stage S) | DONE: account sync in one hook, passport source in the reducer, no cross-component DOM queries |
| Final polish (Stages T, V, W) | DONE (impeccable, minimalist-ui); `review-animations` is user-invoke only |
| Docs + CI file | DONE: README + 7 docs; `.github/workflows/ci.yml` committed in `2fa34e3` |
| Final verification | DONE: lint clean, 57 unit, API smoke 3/3 runs, 37 E2E, map data deterministic |
| Deploy | **DONE**: https://bd-discovery-passport.pages.dev (Pages project + D1 in APAC + `AUTH_PEPPER` secret). Verified live with the API smoke test and a real browser |
| GitHub | **DONE**: commit `2fa34e3` pushed to https://github.com/KabirADnan41/bd-discovery-passport (**public**, `main`; anything pushed is public, so the leak scan must pass before every push). CI (`.github/workflows/ci.yml`) runs on each push; check the Actions tab |
| Security scan (`claude-security`) | NOT RUN: this session has no Workflow tool (enable Dynamic workflows in /config, then restart) |
| **Owner rules (updated 2026-10-17)** | Local commits on feature branches are fine; push, PR, merge to `main`, tag, release and deploy each need the owner's explicit yes for that action (global CLAUDE.md §1-§2). Free tier only; no Firecrawl until the owner says the credits renewed. GitHub is optional: Cloudflare direct upload works without it |
| **v2 round (milestones 30 and 31, 2026-10-05)** | **About 90%** (done items: section 2, rows 37 to 51; remaining: leak scan, then commit, push and deploy, section 3) |
| Project cleanup (stray folder, project skills, MCP scope, `.vscode/`, headroom and PostgreSQL leftovers) | DONE, verified. One owner action left: the empty PostgreSQL 16 install needs an admin shell (section 3) |
| Security audit (read-only) | DONE: 0 npm vulnerabilities; no secrets in tracked files, history or build output; high finding F1 fixed; F2 accepted as residual risk |
| Firewall on the free plan (F1 fix) | DONE: method allowlist, per-IP pre-filter (POST and DELETE only, IPv6 per /64 after the reviews), write-free rate limiter, sign-up honeypot, nosniff on API JSON (section 5; `docs/security.md` section 5) |
| Consent check + privacy notice update | DONE: no consent banner needed (all storage strictly necessary); notice dated 5 October 2026 |
| Quiz mode (Explore / Quiz switch) | DONE: unit + E2E tests (`tests/unit/quiz.test.js`, `tests/e2e/quiz.spec.js`) |
| Places to go + Directions links (334 places, all 64 districts) | DONE: data review finished, 32 corrections, 0 dropped; a random sample of 30 found 1 error (3.3%), fixed (#47) |
| Design brief for the redesign | DONE (Fable) |
| Redesign implementation | DONE (#46) |
| Tests at last check | **2026-10-17 at `b944637` (`feat/trip-planner`): lint clean, 161 unit pass, `validate:data` and build OK, full Playwright suite on desktop + mobile (1 worker) green.** Before that (v2): Lint clean, 97 unit pass (5 files), `validate:data` OK, build OK (main JS 139.73 kB gzip; places chunk 41.59 kB gzip, lazy); E2E 47 passed, 7 skipped (designed mobile skips), 0 failed |
| QA, reviews (code, security, simplicity), fixes, docs | DONE (#48 to #51) |
| Leak scan | DONE: pass with notes; 4 local paths and the D1 id copy removed from docs; old history kept as is (owner's choice) |
| Commit, push, live deploy of the v2 round | DONE (milestone 32): commit `10df59c` pushed and deployed |
| Launch video (2026-10-06) | DONE: `brag-output/brag.mp4` (23 s, 1920×1080, music), poster `brag.jpg`, `share-copy.txt`. Local only: `brag-output/` is ignored by git and ESLint (since 2026-10-17); `brag-output/work/frames/` (224 MB) can be deleted |
| Skills vetting and installs (2026-10-17) | DONE: 13 repos vetted read-only at pinned commits. Installed with the owner's yes: `context7` MCP, 24 agent-skills, 5 hyperframes skills (settings and hooks unchanged). Details: #54 and `skill_review.md` (local only) |
| **Trip planner round (2026-10-06 →)** | **IN PROGRESS**: foundation done on `feat/trip-planner` (reviewed, tested, pushed as a branch on 2026-10-17); map slice verified on `feat/trip-map` (no fixes needed; ready for the owner's review); **resume at section 7** |

---

## 2. Done: task → skill → approach

| # | Task | Skill(s) used (status) | Approach and evidence |
|---|---|---|---|
| 1 | Scan C:\ and D:\ for skills | none (shell + Node) | `dir /s /b` for SKILL.md, then a Node script: frontmatter parse, SHA-256 of SKILL.md and of the whole directory, ecosystem from path. 692 files, 418 unique, 274 exact duplicates, 23 name collisions. |
| 2 | Classify compatibility | none (manual reading) | Read sample SKILL.md files from every family; rules: COMPATIBLE / COMPATIBLE* (needs MCP) / REQUIRES ADAPTATION / INCOMPATIBLE. Verified the global dir via official docs (`~/.claude/skills/<name>/SKILL.md`). |
| 3 | Install globally (283 skills) | none | Copy, never move; backup manifest + rollback script in `%USERPROFILE%\.claude\backups\skill-install-2026-09-28\`. Collisions renamed `<source>-<skill>` including the frontmatter `name`. **Verified live** (the session announced the new skills without a restart). Side effect: past ~110 skills the listing drops descriptions. |
| 4 | Security plugin | `claude-security` | Installed via `claude plugin install`. **UNAVAILABLE in this session** (plugins load at session start); use next session. |
| 5 | Project skill library | none | 21 skills in `.claude/skills/`; impeccable's 16 MB .exe gitignored. Report: `docs/claude-skill-audit.md`. (2026-10-05: moved to the global skills folder, see #38.) |
| 6 | Engineering approach | `andrej-karpathy-skills:karpathy-guidelines` (**APPLIED**, Stage A) | Stated assumptions, verify-steps per task, exact-pinned deps, fail-loud pipeline, removed speculative helpers, no UI library. |
| 7 | Visual direction | `design-taste-frontend` (**APPLIED**), then `high-end-visual-design` (**APPLIED selectively**) (Stage B) | Design read + dials (6/4/3); client palette kept via the skill's override; em-dash ban; eyebrow restraint; passport "cover + page"; rejected glass nav, giant radii, scroll reveals. |
| 8 | UI library decision | `pick-ui-library` (**UNAVAILABLE**: user-invocation only) | Brief's Stage D rule: React + Tailwind + native `<dialog>`/popover; no component or icon library. |
| 9 | Reference image reconstruction | `image-to-code` (**NOT NEEDED**) | No mockups supplied. |
| 10 | Geo pipeline | none (d3-geo, topojson-*) | 419 repo-id joins, 118 orphans by ADM2 point-in-polygon, **7 upstream mis-joins fixed** via reviewed `data/source/corrections.json`, shared-arc simplify (25%) + merge, Transverse Mercator 90°E, compact paths. 521 KB → 136 KB. |
| 11 | Data validation | `data:validate-data` (**NOT NEEDED**: it QA's analyses) | `scripts/validate-map-data.mjs` before every build: ids, joins, bbox, neighbours, stamp codes, https sources, no markup, no dashes. |
| 12 | Content verification | none | UNESCO first, Wikipedia secondary (Banglapedia blocked). Claims never exceed the source. |
| 13 | Map, card, stamp, gazetteer | karpathy + design-taste (APPLIED) | Inline SVG, roving tabindex + spatial arrows, overlays for hover/selection/focus, hatched vs solid (not colour alone), SVG-filter stamp. |
| 14 | Browser QA | `chrome-devtools` (**UNAVAILABLE** this session; `.mcp.json` added; 2026-10-05: moved to user scope and the project `.mcp.json` deleted, see #38) | Playwright scripts: screenshots at 375/430/768/1024/1440, console errors, overflow. |
| 15 | Theme (user request) | design-taste §6.C/§8 (APPLIED) | `public/theme-init.js` pre-paint (CSP-safe), `useTheme`, System / Light / Dark radio group in the menu; transitions suppressed for the switch frame. |
| 16 | Accounts (user request) | karpathy (APPLIED) | Cloudflare Pages Functions + D1. Browser PBKDF2-SHA256 600k; server HMAC + pepper (free plan = 10 ms CPU; PBKDF2 100k measured 15 ms). `__Host-` HttpOnly Secure SameSite=Strict cookie, hashed sessions, Origin + JSON checks, D1 rate limits (IP only as HMAC), union stamp sync, password-confirmed deletion. `/api/me` returns 200 for guests. `tests/api/smoke.mjs` 24/24; browser flow passes. |
| 17 | Motion opportunities (Stage G) | `find-animation-opportunities` → `animation-vocabulary` → `animate` (all **APPLIED**) | 5 of 10 candidates kept: symmetric sheet exit (`usePresence`, `inert`), dialog + menu `@starting-style` in/out, origin-aware menu, tooltip enters once, ledger tick after the stamp. `--ease-out` = `cubic-bezier(0.23,1,0.32,1)`. Reduced motion = fades only. |
| 18 | Motion audit (Stage H) | `improve-animations` (**APPLIED**) | 4 fixes: reduced-motion gating on stamp thumbnails, press feedback 160 ms on the shared token (stray `--ease-press` removed), colour changes use `ease`, single movement inside the mobile sheet. |
| 19 | Interaction feel (Stage I) | `emil-design-eng` (**APPLIED**) | Drag-to-dismiss on the mobile sheet (velocity > 0.11 px/ms or 30% of height, pointer capture, upward friction, transform set directly), instant `:active` press on districts (brightness, no scaling). Browser-verified: slow drag snaps back, flick dismisses. |
| 20 | Toasts (Stage J) | `ask-sonner` (**NOT NEEDED**) | Status shown in place (menu sync line, inline errors, aria-live). |
| 21 | Accessibility audit (Stage K) | `web-design-guidelines` (**APPLIED**, rules fetched fresh) | Fixed: `outline-none` on the focused title, long-name overflow, `Intl.NumberFormat('bn-BD')` for Bengali numerals, input `name`, focus the first form error, `overscroll-behavior` on the menu, sync failures announced via aria-live, `text-balance`, `translate="no"` on the brand, safe-area padding, **deep links** (`?district=54` opens that page). Deliberate: sentence case (editorial style). |
| 22 | Website policies (user request, 2 articles) | none | Crocoblock (placement, affirmative consent) + Riverworks (7 policy types): built a **privacy notice** (incl. cookies/storage table, retention, 7-day backup window, rights, children, hosting) and **terms of use** (accounts, no password reset, acceptable use, content sources, **map disclaimer**, credits, no-ads disclosure). Return/shipping policies not applicable. |
| 23 | *Privacy's Blueprint* (Hartzog, added by the user) | none | Applied trust / obscurity / autonomy and the deceptive / abusive / dangerous design standards: the guest-stamp merge is **opt-in on sign-in** (pre-checked only on sign-up), a required *unticked* terms box on sign-up, the notice is linked at the decision point, "usernames are never shown to anyone" stated, and neutral cancel labels (no confirmshaming). |
| 25 | Test suite (Stage O) | `@playwright/test` + `@axe-core/playwright`, Vitest | `tests/e2e/`: discovery, keyboard (one tab stop, arrows, Enter, Escape returns focus), persistence, reset confirm, deep link, 5-width overflow, no-JS policy pages, accounts (terms box, merge rules, wrong password, delete), axe WCAG 2.2 AA in light + dark. `tests/unit/`: reducer, storage hardening, navigation, sheet gesture, server auth helpers, browser PBKDF2, validator, **token contrast for both themes**. Found and fixed a real bug: vermilion small text was 4.34:1 on the highlighted row (new `--accent-stamp-text` #a8332c). |
| 26 | Performance (Stage N) | `debug-optimize-lcp` (**NOT NEEDED**), `memory-leak-debugging` (**NOT NEEDED**) | `scripts/measure-performance.mjs`: desktop LCP 988 ms, CLS 0.001; **Slow 4G + 4x CPU phone LCP 1,768 ms, CLS 0.004**; 342 KB transferred (fonts 196 KB, JS 133 KB gz). Both within "good" thresholds. Optional later: subset the Bengali font. |
| 27 | Code review (Stage R) | built-in `code-review` (**APPLIED**, high) | 10 findings, all real, all fixed: guest stamps now cleared only after the server confirms the merge; merge uses the in-memory stamps the dialog promised; stale upload responses ignored via an epoch + in-flight dedupe; **login lockout DoS fixed** (limits count failed guesses per username+network, plus a per-username cap); **account deletion no longer an unlimited password oracle**; rate-limit keys store usernames only as HMACs and are wiped on deletion; no guest-storage writes while the account is still being checked; key derivation failures show a message instead of hanging; `:popover-open` selector replaced + **Popover API fallback for iOS 16 and older browsers**; broken `preview` script fixed. Also removed the unused Noto font dependency and a dead sync state. |
| 29 | Security review (Stage Q) | built-in `security-review` (**UNAVAILABLE**: it diffs against `origin/HEAD`; creating a remote/commit needs the user's OK), so a manual OWASP-style review | Checked injection, XSS, CSRF, sessions, passwords, brute force, secrets, headers, dependencies, data integrity, DoS. Fixed: SQL `LIKE` wildcard risk in counter cleanup (exact prefix match), oversized bodies rejected from `Content-Length` before reading, **max 10 sessions per user** (verified: 13 sign-ins leave 10 rows). Smoke test adds a 413 check. All suites green. |
| 30 | Simplify (Stage S) | built-in `simplify` (**APPLIED**; 1 of its 4 parallel reviewers finished before the usage limit, the other 3 angles were done inline) | **Altitude:** new `usePassportSync` hook owns synced/in-flight/epoch/merge state with one `restart()`; the passport `source` (`pending`/`guest`/`account`) lives in the reducer, so mode and stamps change in one dispatch (replaces the `persistLocally` flag and `pendingMergeRef`); `useAccount` reports only what it finds on load (`onRestored`/`onGuest`); the menu reports its open state by prop (no `data-open` DOM query); sheet/masthead refs instead of `querySelector`; `clearGuessCounters` helper. **Reuse:** `shared/credentials.js` (username rule + base64url) used by browser and server; one `.field-input` style. **Efficiency:** guess-limit check is one query, failed-guess recording one batch. Also fixed: merged guest stamps that the account already had now clear the guest copy. Kept on purpose: explicit child-row deletes on account deletion. |
| 31 | Final polish (Stage T) | `impeccable` v4.3.1 (**APPLIED**, `polish`; context loader ran; scoped refinement of the existing system, no PRODUCT.md needed) | Craft-floor fixes: removed the banned eyebrows ("District No." label and uppercase category labels above landmark names; categories now sit right-aligned like atlas index entries), removed the "←" glyph standing in for an icon, themed scrollbars, caret and native control accent. Detector (run once): 1 finding (thick border on rounded sheet corners), fixed by making the sheet the green cover with a concentric paper page. One batched inspection (desktop + mobile, light + dark): clean. A newer impeccable (v4.4.0) exists; update only if the user asks (`npx impeccable update`). |
| 32 | Clutter check (Stage V) | `minimalist-ui` (**APPLIED** as a diagnostic lens) | Only one redundant sentence removed; the atlas character stays. |
| 33 | Final motion review (Stage W) | `review-animations` (**UNAVAILABLE**: user-invoke only; run `/review-animations` yourself if you like) | Motion was already verified in both modes. |
| 34 | Design research (Phases 15-16, done late) | none | Local `design-md` (Airbnb, Wired, Apple, The Verge) + Codrops/CSS-Tricks/platform sheet guidance; one change: passport notes at 16 px. See `docs/design-research.md`. |
| 35 | Docs | none | `README.md`, `docs/architecture.md`, `data-sources.md`, `security.md` (STRIDE, SDL, PICERL, Hartzog), `design-research.md`, `deployment.md`, `project-skills.md`, `skill-usage-log.md`; `.github/workflows/ci.yml`. |
| 36 | Late bug found by the tests | none | The session cap sorted by expiry time, which ties for same-second sign-ins and could drop the new session; now sorted by insertion order, with a regression check. |
| 28 | Repo hygiene | none | `/reference/` (copyrighted books) gitignored at the root only; `.gitattributes` pins LF; `git add -N` used for review diffs (no commits, per the user). |
| 24 | Security headers | brief Stage 22 rules | `public/_headers`: strict CSP, nosniff, DENY framing, referrer policy, permissions policy, COOP, CORP, HSTS, immutable `/assets/*`. Verified with curl against `wrangler pages dev`. |
| 37 | v2 round process (owner's rules, 2026-10-05) | `karpathy-guidelines` (**APPLIED**: simple code) | Work distributed to sub-agents, one task each, in parallel when independent. Model routing: Fable for review and design direction, Opus for edits and research. Briefs written in the style of the owner's prompt library (labelled blocks, rules with reasons, decision paths, honest scoped reports, silent self-check). The session crashed twice from low memory; agents were resumed from saved transcripts, research agents then saved after every district, and heavy jobs (build, wrangler, Playwright, browsers) now run one at a time. Later in the round the session crashed again and the network dropped; agents were resumed or re-briefed, and heavy jobs stayed one at a time. |
| 38 | Project and machine cleanup | none | Verified. Removed an accidental older copy of another project folder (253 MB) from the project root. The project's 21 copied skills moved to the global skills folder: 27 parked frontend skills restored globally with the owner's permission, 12 identical copies deleted, 9 differing copies archived (global versions kept as newer). chrome-devtools MCP moved to user scope; project `.mcp.json` and `.vscode/` deleted; `.gitignore` now ignores `/.vscode/`, `/skill_review.md`, `/.gstack/`. headroom leftovers removed (a plugin-usage entry, ~30 MB of uv cache). A portable PostgreSQL + pgAdmin copy inside another project's `.local` folder and installer leftovers in Temp deleted; the empty PostgreSQL 16 install in Program Files (default databases only) is an owner action (section 3). |
| 39 | Security audit | none (read-only audit agent, Fable) | 0 npm vulnerabilities; no secrets in tracked files, git history or build output. **High finding F1:** rate-limited login and sign-up still wrote D1 rows, so one IP could exhaust the free 100k writes/day (fixed in #40). F2 (sign-up reveals that a username is taken) accepted as residual risk. Docs no longer name the pepper backup location or home-folder paths. |
| 40 | Firewall on the free plan (F1 fix) | `karpathy-guidelines` (**APPLIED**) | WAF, Bot Fight Mode and the rate-limit binding are not available on `*.pages.dev`, so in code: method allowlist in `functions/api/_middleware.js` (405), isolate-local per-IP pre-filter of 60 requests / 60 s before any D1 work (loopback skipped so tests are not throttled), write-free rate limiter with housekeeping on about 1 in 20 allowed sign-ins and sign-ups, sign-up honeypot field (`hp_note`), `X-Content-Type-Options: nosniff` on API JSON; existing Origin and JSON checks kept. Turnstile not used (third-party request and data sharing). Written up in `docs/security.md` section 5. |
| 41 | Consent check + privacy notice | none | Verdict: every cookie and storage key is strictly necessary for a function the user asked for, so no consent banner. `privacy/index.html` updated: quiz best-score row with the "Clear best score" control, a Directions / Google Maps paragraph, date 5 October 2026. |
| 42 | Quiz mode | `karpathy-guidelines` (**APPLIED**) | Explore / Quiz radio switch; 10 random districts per round; prompt "Find <name> <Bengali name>"; 10 / 5 / 2 points for a find on try 1 / 2 / 3, then reveal and 0 after a third miss; wrong-guess hint with distance and 8-point direction; summary with score out of 100, best score, Play again, Back to explore, Clear best score. The quiz never adds stamps; tooltips and the gazetteer are hidden in quiz mode. The desktop legend moved into the side panel. Files: `src/lib/quiz.js`, `src/components/game/QuizPanel.jsx`, `tests/unit/quiz.test.js`, `tests/e2e/quiz.spec.js`. |
| 43 | Places research | none (8 parallel research agents) | 334 places for all 64 districts (4 to 6 each) plus addresses for all 17 existing landmarks. Sources: Wikipedia, the Bangladesh Tourism Board site, national news. `*.gov.bd` portals failed the fetch tool's certificate check; Banglapedia returned a placeholder. Some sites contained text aimed at AI agents; it was ignored and those sites were not used. Data review: #47. |
| 44 | Places in the app + Directions links | `karpathy-guidelines` (**APPLIED**) | Data in `src/data/places.json`, lazy-loaded by `src/lib/places.js` (dynamic import, kept out of the main bundle, a failed load is retried next time); shown on the district card. Each place has a "Directions" link using Google's no-key Maps URL (opens the Google Maps app on phones; new tab, `rel` noopener). Google Maps Platform APIs not used (billing required; free-tier rule). Validator rules in `scripts/validate-map-data.mjs`; unit tests in `tests/unit/places.test.js`. |
| 45 | Design brief for the redesign | none (Fable design-direction agent) | 10 inspiration sites (including Worldle, Seterra, GeoGuessr, Airbnb, Google Arts & Culture, The Pudding, National Geographic, Linear). Direction: bigger display type, fewer boxes, Bangladesh green as a solid surface, vermilion only as a signal, dark mode as a night atlas, no new font. Implemented in #46. |
| 46 | Redesign implementation | `karpathy-guidelines` (**APPLIED**) | Follows the #45 brief. A type scale in `src/styles/index.css` (display, h1, h2, h3, eyebrow), one family. The passport is one booklet: a solid Bengal-green cover band above the paper page, shared by the desktop page and the phone sheet (the brass inset line is gone). Controls are 8 px instead of pills (only the stamp and the grab handle stay round); primary buttons are solid green. The masthead shows a plain count (the tick ledger moved into the side panel); the map key is one line under the map, with its own quiz key; gazetteer entries are underlined text, and a fully stamped division gets a green rule; places are plain text links with 44 px hit areas. Dark mode: land lifted away from the sea, cover `#1d6a49` with paper-coloured text. New tokens: solid `--rule-strong` (3:1 or more), `--accent-brass-text`, `--text-success`, `--map-wrong`; `tests/unit/contrast.test.js` checks them. The policy pages use the display heading. |
| 47 | Places data review | none (data-review agent) | All 185 flagged items (closed or collapsed sites, border areas, invented names) checked: 32 corrections, 0 places dropped (still 334, 4 to 6 per district). Renames include Teliapara Smriti Soudho, Arunima Resort Golf Club, Jamai Pagol Mazar, Jiner Mosque and Madhupalli (Michael Madhusudan Dutt's House). Chittagong Hill Tracts entries note that foreign visitors may need permission. A random sample of 30 (seed 20261005) found 1 error (3.3%), fixed. |
| 48 | QA (Phase J) | none (QA agent; heavy jobs one at a time) | Build OK; API smoke 29/29; firewall 3/4 at first (a login blocked by the per-username limit still wrote a `login:ip` row; fixed in #50). Performance: desktop LCP 892 ms, phone LCP 2,056 ms, CLS 0.014. Maps spot-check: 8 of 8 random Directions links correct; 4 suspect links fixed (Shilua stone address; the Kulia mosque renamed Uttar Kulia Jame Masjid, with the Bengali village name in the address because Google lists it only in Bengali; Garaitupi renamed Goraitupi Mazar, village-level pin; Aat Kobor address set to Damurhuda, Chuadanga). Directions links are checked in a headless browser, no API key. |
| 49 | Reviews (Phase K) | Code, security and simplicity reviewers, in parallel | **Code review:** 4 findings (HIGH: a quiz guess after the round ended crashed; MED: the pre-filter counted `GET /api/me`, so users behind carrier-grade NAT could hit false 429s; LOW: honeypot; LOW: phone quiz tab order). **Security review:** 5 findings (MED: IPv6 not grouped, now per /64 for rate limits; LOW: honeypot renamed from the autofill-prone `website` to `hp_note`; LOW: burst race, accepted and documented; LOW: privacy retention wording; 1 info); `npm audit` 0. **Simplicity review:** 9 suggestions, 8 applied (PlacesToGo live flag, `--color-on-cover`, `POINTS[0]`, merged quiz tests, authClient default, quiz state from the marks, unused `quiz-*` CSS, impossible validator guards, an unused middleware parameter); skipped on purpose: merging `.link` (not identical) and removing the pulse animation. |
| 50 | Fixes (Phase L) | Fix agent | All review and QA findings fixed. Among them: the pre-filter counts only non-GET requests and groups IPv6 by /64, and a login blocked by the per-username limit no longer writes a `login:ip` row. Not changed on purpose: `useAccount` handling of 429, because `/api/me` can no longer get a 429 from our code, and Cloudflare's own daily-limit 429 correctly shows "Accounts are unavailable". |
| 51 | Docs (milestone 31) | none (docs agent) | PROGRESS.md brought up to date (the GitHub repo is public, not private); README, `docs/architecture.md`, `docs/data-sources.md`, `docs/security.md`, `docs/design-research.md` and `docs/deployment.md` now cover the quiz, places with Directions links, the redesign and the free-plan firewall. |
| 52 | Launch video (2026-10-06) | `brag` → `brag-slim` (**APPLIED**; the Opus route) | Inspection agent, then two agents in parallel. **Visuals:** a Vite harness in `brag-output/work/harness/` renders the real map, passport card, stamp, quiz panel and progress components with the app's CSS; every frame is a pure function of time (`__setTime(t)`, CSS animations paused and seeked); Playwright captured 690 frames, ffmpeg encoded them. **Audio:** a dependency-free Node synth (`work/audio/score.mjs`), 120 BPM, D major pentatonic, cues locked to the picture; −15.8 LUFS, −3.7 dBTP. The poster is the 3.2 s hook frame, baked in as frame 0. Output: `brag-output/brag.mp4`, `brag.jpg`, `share-copy.txt`, `brag-plan.md` (untracked). |
| 53 | Trip planner plan (2026-10-06) | none (main session) | Planned with the owner, then trimmed to free-tier-only (no account sync), plus PDF download and the Bengali pipeline. Decisions and phases: section 7. |
| 54 | Skill and MCP vetting + installs (2026-10-17) | none (read-only vetting agents on pinned clones) | 13 repos checked for code execution, downloads, network calls, keys, Claude-config edits, obfuscation, prompt injection and reputation. Installed with the owner's yes: `context7` MCP `@upstash/context7-mcp@4.4.2` (user scope), 24 addyosmani `agent-skills` @ `aeac41d` (not `browser-testing-with-devtools`, not the plugin commands), 5 heygen `hyperframes` skills @ `fa93669` (telemetry disabled; no `media-use`). Declined: context-mode (edits Claude config, hooks every tool call), gbro-collage-broll (paid Gemini video), strix (needs Docker + a model key). Catalogue: `skill_review.md` (local only). |
| 55 | Owner rules updated (2026-10-17) | none | New global CLAUDE.md: branch-first work, feature-branch push rules (§2), token economy (§3), sub-agent orchestration (§4: one implementation agent per slice, fresh-context review when useful, at most 2 agents, no recursion), RED → GREEN → REFACTOR, AI-readable code. Model routing: Fable for code and architecture review only (weekly limit), Opus for hard bugs and fixes, Sonnet for routine work, Haiku for lookups. New `docs/ai/INDEX.md` (code map) and `docs/ai/CURRENT.md` (current state only). |
| 56 | Trip planner foundation (`feat/trip-planner`, 2026-10-17) | `karpathy-guidelines` (**APPLIED** as the simplicity rule in every brief) | Each slice: implementation agent → machine checks → review → main-session diff check and rerun → local commit. Fable review of the trip logic (2 findings, each reproduced by a failing test, fixed in `63b431f`). "Add to trip" on places (`b37b2f3`; accessible names start with the visible words, WCAG 2.5.3). Planner screen in Plan mode (`b944637`; fresh-context review approved; 1 medium (empty trip kept stray days) and 1 low (duplicated dialog) fixed). Checks at `b944637`: lint, 161 unit, build, full E2E desktop + mobile green. |
| 57 | Map slice started (`feat/trip-map`, 2026-10-17) | none | Branched from `feat/trip-planner` (`341b678`). Owner's spec: district-level pins at each district's existing `label` anchor (no invented coordinates; several stops in one district share one pin with a count), one dashed route per day (never joined across days), labelled "approximate", phone "Show on map" / "Back to day N" (no modal, no second map). The implementation agent was stopped at the session close just before its final checks: its work is saved as an unverified WIP commit and pushed with the branch (section 7). |
| 58 | Map slice verified (`feat/trip-map`, 2026-10-17 evening) | none (main-session verification, following the owner's resume steps) | Reviewed the `wip(trip-map)` diff: `BangladeshMap.jsx` only gained `PIN_RADIUS`, the optional `tripMap` prop and the non-interactive `.trip-overlay` group (aria-hidden, `pointer-events: none`, drawn under the keyboard focus outline). No handler, tabindex or keyboard change, so no extra reviewer. Checks, one at a time: lint exit 0; Vitest 171/171; build OK; `trip-map.spec.js` 13 passed + 3 by-design skips (desktop + mobile); planner + discovery + accessibility + quiz on desktop 41/41; planner + discovery on mobile 23 passed + 4 by-design skips; `trip.spec.js` 12/12. The tests pin each pin to its district's own `label` anchor and check each day's route points and the day break. Visual check of the built site on desktop and phone, light and dark: no issues. GitHub CI green on `feat/trip-map` (`2898e2a`) and `feat/trip-planner` (`341b678`). No fixes needed. |
| 59 | Drag to reorder (`feat/trip-drag-reorder`, 2026-10-17) | none (one implementation agent, Opus; main-session verification) | `a4a4979`. A pointer-only grip per stop (`aria-hidden`, never focused); Move up / Move down stay the keyboard baseline. A drop reuses `moveStop()` unchanged and saves through `onEdit` with the shared "Moved …" message (`movedMessage`) and no focus change. Pure `dropTarget()` in `src/lib/tripReorder.js` (9 unit tests) turns the pointer height into moveStop's final `{ day, index }`; rows are measured once, in page coordinates. The held stop lifts in place; the drop line is a shadow (no layout shift) and only shows where `moveStop` would accept. Escape / pointercancel drop nothing. No auto-scroll (`ponytail:` note). Main-session checks, one at a time: lint exit 0; Vitest 180/180; build OK; `trip-drag.spec.js` 14 passed + 2 by-design skips (mobile test uses real touch through CDP); planner + trip-map on both projects 44 passed + 4 known skips; trip + accessibility + discovery on desktop 29/29; visual check desktop + phone, light + dark. Low note, not changed: `measureDays` uses a document-wide query (fine while there is one planner). Not tested: Safari, Firefox, a real iOS device. |

---

## 3. Still to do

### v2 round: remaining steps (in order; heavy jobs one at a time)
| # | Step | Who | Note |
|---|---|---|---|
| 1 | Finish the redesign | Redesign agent | **DONE** (#46) |
| 2 | Finish the places data review | Data-review agent | **DONE** (#47): 32 corrections, 0 dropped; sample of 30 had 1 error, fixed |
| 3 | QA | QA agent | **DONE** (#48): 8 of 8 random Directions links correct, 4 suspect links fixed |
| 4 | Reviews | Code, security and simplicity reviewers, in parallel | **DONE** (#49) |
| 5 | Fixes | Fix agent | **DONE** (#50) |
| 6 | Leak scan | Leak-scan agent | DONE: pass with notes, doc fixes applied. Run it again before every push; the GitHub repo is public |
| 7 | Docs | Docs agent | **DONE** (#51) |
| 8 | Commit, push, deploy | Main session | DONE: commit `10df59c` pushed and deployed, live verified. Redeploy: `npm run build` + `npx wrangler pages deploy dist --project-name bd-discovery-passport --branch main` |

### Needs you (owner actions; nothing above waits on them)
| # | Task | What you do | Note |
|---|---|---|---|
| 1 | Remove the empty PostgreSQL 16 install | In an Administrator PowerShell: `Remove-Item -LiteralPath 'C:\Program Files\PostgreSQL' -Recurse -Force; Remove-Item -LiteralPath 'HKLM:\SOFTWARE\PostgreSQL' -Recurse -Force` | Only default databases inside; needs an admin shell |
| 2 | Pepper copy | Keep it only in your password manager | Losing it only matters if the site is ever rebuilt on a new project |
| 3 | Marketing connectors (optional) | Sign in to Slack, Notion, Ahrefs and the others in claude.ai settings, only if you want them | Not used by this project |
| 4 | Merge decision (later) | When the trip planner is finished and reviewed, say yes before anything is merged into `main` or deployed | `feat/trip-planner` and `feat/trip-map` were pushed as branches on 2026-10-17 at the owner's request (backup); `main` and the live site are unchanged |
| 5 | New Gemini key | Delete the key pasted in chat, create a new one, set `GEMINI_API_KEY` yourself, check it is on the free tier | Only for the optional Bengali notes (section 7) |
| 6 | Review the map slice | Try `feat/trip-map` locally (`npm run dev`, Plan mode) or on GitHub; then say whether the new local docs commit may be pushed and which slice comes next | Verified 2026-10-17 evening with no fixes needed (#58) |

### Optional extras
| Task | Skill / approach | Note |
|---|---|---|
| Deep security scan | `claude-security` (AVAILABLE) | Multi-agent; uses a lot of your usage allowance |
| Final motion review | `/review-animations` (you run it) | User-invoke only |
| UI library second opinion | `/pick-ui-library` (you run it) | User-invoke only; current answer: none needed |
| Product context for design tools | `/impeccable init` (writes PRODUCT.md) | Helps future design passes |
| Update impeccable | `npx impeccable update` | v4.4.0 available; only if you want it |
| Faster first paint on slow phones | Prerender the page shell so the map paints before JavaScript | Live LCP on throttled Slow 4G is 2.45 s (limit 2.5 s); the v2 build measured 2,056 ms in QA. The top optional performance win |
| v2 ideas | Passkeys; Bengali font subsetting; more verified districts | See the approach audit |

---

## 4. Approach audit: is there a better method?

| Decision | Chosen | Alternatives considered | Verdict |
|---|---|---|---|
| Map technology | Inline SVG, build-time paths | Leaflet/MapLibre (banned by the brief), Canvas/WebGL | **Keep**: best for 64 accessible, focusable shapes. |
| District geometry | Dissolve ADM3 by district id | geoBoundaries ADM2 directly | **Keep**: the brief requires ADM3 + repo ids, and the dissolve exposed 7 upstream errors. |
| Orphan polygons | ADM2 point-in-polygon, cross-checked | Manual list; nearest centroid | **Keep**: agreed with 419/426 joins; every disagreement was upstream. |
| Payload delivery | Map JSON bundled into the JS | Prerender the SVG into index.html | **Possibly better** (map paints before JS). Decide after measuring. |
| Fonts | Anek Bangla wght axis (~200 KB) | System fonts; glyph subsetting | **Subsetting likely better**. Evaluate with measurements. |
| Accounts platform | Cloudflare Pages Functions + D1 | Supabase (pauses when idle), Firebase (third-party SDK), Neon/Vercel (two providers), self-hosting (not 24/7) | **Keep**: never sleeps, same origin, over-limit requests fail instead of billing. |
| Sign-in method | Username + password, browser PBKDF2 600k, server HMAC + pepper | Passkeys; Sign in with Google; email magic links | **Keep for v1**; passkeys are the recommended v2 (phishing-proof, no password DB). No reset without email (stated in the terms). |
| Abuse protection | D1 rate limits + an in-code firewall (method allowlist, per-IP pre-filter, honeypot) | Cloudflare Turnstile; WAF rule (needs a custom domain) | **Keep**; Turnstile only if spam appears. |
| Directions to places | Google's no-key Maps URL, opened in a new tab | Google Maps Platform APIs (billing required); an embedded Google map (third-party requests and a CSP change) | **Keep**: free, nothing is sent to Google until the user chooses the link. |
| Sessions | HttpOnly cookie, hashed token | JWT in localStorage | **Keep**: safer against XSS. |
| Theme without flash | External `theme-init.js` | Inline script + CSP hash | **Keep**. |
| Keyboard map access | Roving tabindex + arrows + gazetteer | 64 tab stops | **Keep**. |
| Policy pages | Static HTML pages in the Vite build (no JS) | React routes; a CMS; a generated policy service | **Keep**: fast, readable without JS, versioned with the code. |
| Privacy defaults | Opt-in merge on sign-in; nothing stored for guests | Always merge (convenient, but can mix people's data on shared devices) | **Keep** (Privacy's Blueprint: protective defaults). |
| Browser QA tooling | Playwright | chrome-devtools MCP | **Keep**; the MCP is ready for the next session. |

---

## 5. Key facts and decisions (do not re-litigate)

- Zero budget, small audience: free tiers only; no paid services, analytics or third-party auth SDKs.
- Nothing runs on the owner's PC after deploy: Cloudflare hosts the site, the API and the database (D1 Time Travel keeps 7 days of backups).
- The source repo's district ids are authoritative; any new ADM2 disagreement fails the build.
- Passport `source`: `pending` until `/api/me` answers, then `guest` (localStorage) or `account` (server). Sign-up merges guest
  stamps by default; sign-in merges only if ticked. The guest copy is cleared only after the server confirms the merge.
- Rate limits: 5 sign-ups per network per hour; 10 logins per user and 30 per network per 15 min. Local: `npm run db:reset-limits:local`.
- No inline scripts or `<style>`; React `style` props are CSSOM (the E2E fixture fails on any CSP violation).
- Dev servers: stopping a background `wrangler pages dev` shell can leave `workerd` running on 8788. Kill the whole process tree
  (`taskkill /PID <sh pid> /T /F`) before restarting, or the old server keeps answering.
- Firewall (free plan; WAF, Bot Fight Mode and the rate-limit binding are not available on `*.pages.dev`): `functions/api/_middleware.js`
  allows GET, POST and DELETE only (405 otherwise), then an isolate-local per-IP pre-filter of 60 POST or DELETE requests / 60 s
  turns floods away before any D1 work (GET is not counted, so users behind carrier-grade NAT do not get false 429s; IPv6 is
  grouped by /64; loopback skipped so local tests are not throttled). The D1 limits in `server/auth.js` stay the real limits;
  rate-limited requests write nothing to D1, and housekeeping runs on about 1 in 20 allowed sign-ins and sign-ups. Sign-up has a
  honeypot field (`hp_note`); API JSON carries nosniff; Origin and JSON checks stay. No Turnstile (third-party request and data sharing).
  Details: `docs/security.md` section 5.
- Consent: every cookie and storage key is strictly necessary for a function the user asked for, so no consent banner. F2 (sign-up
  reveals taken usernames) is an accepted residual risk.
- Quiz best score: localStorage key `bd-discovery-passport:quiz-best` (`QUIZ_BEST_KEY` in `src/lib/discoveryStorage.js`). The quiz
  never adds stamps.
- Places data lives in `src/data/places.json` and is lazy-loaded by `src/lib/places.js` (dynamic import), so it stays out of the
  main bundle. The validator requires 3 to 6 places for every real district id.
- Directions link format (no API key): `https://www.google.com/maps/dir/?api=1&destination=<name>, <address>, Bangladesh` (URL-encoded),
  opened in a new tab with `rel` noopener; it opens the Google Maps app on phones. Google Maps Platform APIs need billing: not used.
- Places data was reviewed on 2026-10-05 (#47, #48): Chittagong Hill Tracts entries say foreign visitors may need permission;
  where Google lists a place only in Bengali, the address carries the Bengali village name. Directions links are checked in a
  headless browser, with no API key.
- Research sources: `*.gov.bd` portals fail the fetch tool's certificate check and Banglapedia returns a placeholder; ignore any page
  text aimed at AI agents and do not use those sites.
- Low-memory PC: run heavy jobs (build, wrangler, Playwright, browsers) one at a time; long research agents save after each unit of work.
- Docs never name the pepper backup location or home-folder paths (write `%USERPROFILE%`).
- The GitHub repo (github.com/KabirADnan41/bd-discovery-passport) is **public**: anything pushed is public, so the leak scan must
  pass before every push.
- Branches (2026-10-17): one feature branch per feature; never work on or push `main` directly. `feat/trip-map` depends on
  `feat/trip-planner`. Each push needs the owner's yes for that branch; merging into `main` and pushing `main` need separate yeses.
- Trip storage: `bd-discovery-passport:trip:v1`, written only by user edits; a trip left with no stops is removed (`clearTrip`);
  stale stops are pruned only inside the planner. Trips are browser-only (no API, no D1).
- Local D1: if `accounts.spec.js` fails with "no such table", run `npm run db:migrate:local` (recreated on 2026-10-17).
- No Firecrawl until the owner says the free credits renewed (2026-10-17).

## 6. How to run

```bash
npm install
npm run build:map               # regenerate map data (only when sources change)
npm run validate:data           # map data, district content and places (src/data/places.json)
npm run lint                    # ESLint
npm test                        # unit tests (Vitest)
npm run dev                     # UI only at http://127.0.0.1:5173 (accounts show "unavailable")
npm run db:migrate:local        # first time: create the local D1 tables
npm run dev:full                # build + wrangler pages dev at http://127.0.0.1:8788 (UI + accounts + headers)
npm run test:api                # API smoke test against dev:full
npx playwright test             # E2E (starts wrangler itself if nothing is running)
```

Local secret: `.dev.vars` contains `AUTH_PEPPER=<random>` (gitignored; regenerate with
`node -e "console.log(require('crypto').randomBytes(32).toString('base64url'))"`).

---

## 7. Trip planner round (started 2026-10-06, milestone 33): resume here

Started 2026-10-06 (owner's green light at 14:19, UTC+6). On 2026-10-17 the foundation was finished on the local branch
`feat/trip-planner` and the map slice was started on `feat/trip-map`. Both branches were pushed to GitHub on 2026-10-17 at the
owner's request (backup); nothing merged or deployed.

### Decisions (owner, 2026-10-06; do not re-litigate)
- **Browser-only, free tier:** no new `/api` endpoints, no D1 tables, no new server writes. Trips live in localStorage
  (`bd-discovery-passport:trip:v1`). Moving a trip to another device = share link. Account sync for trips is dropped.
- **Shape:** a trip is a list of days; at most 10 days and 10 stops per day (each day's Google Maps link then has at most
  8 waypoints). A stop is a place or a whole district and appears once per trip.
- **Place IDs:** stored in `src/data/places.json` as `<districtId>-<slug>` (e.g. `54-shah-jalal-dargah`), never computed at runtime.
- **Directions:** one no-key Google Maps link per day (`origin`, `destination`, `waypoints`). Places use name + address (same
  format as the existing Directions link); districts use the district town's `lat,lon`. Distances are straight-line between
  district towns and are labelled that way.
- **PDF:** "Download PDF" lays the trip out as A4 pages in the browser, captures each page as an image with a library that lets the
  browser draw the text (SVG foreignObject, e.g. modern-screenshot; not html2canvas, which can break Bengali), and puts the images
  in a PDF (e.g. jsPDF) with clickable link areas over the Directions links. Lazy-loaded on click. Keep a "Print / Save as PDF"
  fallback on the same layout (real, accessible text). The CSP already allows `data:` images.
- **Bengali notes (Phase 0b):** a one-time data step, never per visitor. Claude writes the English, Gemini translates it to Bengali,
  then Gemini re-audits in a fresh pass (back-translation to English; Claude compares the meaning; a script checks that numbers,
  dates and place names match the existing `name.bn`). Flagged items go back to Gemini. Results are saved as `note.bn` (and
  Bengali categories) in places.json. Addresses stay English because the Directions links use them. About 40 requests, free tier.
  Needs the key in the `GEMINI_API_KEY` user environment variable and the owner's yes for that run (global rule).
  **Optional content enrichment** (owner, 2026-10-17): it never blocks reviewing or shipping the planner.
- **Gemini at runtime is ruled out:** the key cannot sit in the browser, the free quota is shared by all visitors, it would add
  server load, and free-tier prompts may be used by Google.

### Phases
| Phase | What | State |
|---|---|---|
| 0a | Stored place IDs, validator rule, validator tests | **DONE** (Agent A, verified): 334 ids, all unique, `id` first key in each place (diff = 334 added lines only); validator rule in `scripts/validate-map-data.mjs` (format, district prefix, unique file-wide); 3 new cases in `tests/unit/security.test.js` that fail without the rule. Examples: `1-star-mosque`, `54-bichanakandi` |
| 0b | Bengali notes via Gemini (see decisions) | TO DO: needs the owner action below and a yes for the run |
| 1 logic | `src/lib/trip.js` + `tests/unit/trip.test.js`: model, limits, per-day Directions URL, distances, hardened storage | **DONE** (Agent B, test-first, verified): `trip.js` 118 lines of pure functions (`createTrip`, `hasStop`, `addStop`, `removeStop`, `moveStop`, `addDay`, `removeDay`, `renameTrip`, `pruneUnknownPlaces`, `locationOf`, `dayDirectionsUrl`, `legDistancesKm`, `loadTrip`, `saveTrip`); 57 tests. Small edits: `TRIP_KEY` + exported `getStorage` in `discoveryStorage.js`; `DIRECTIONS_URL` + `placeLocation` exported from `places.js` (same link output). Not yet used by any UI, so nothing is stored yet |
| 1 UI | "Add to trip" on places and district pages; Plan / পরিকল্পনা mode (reorder by drag and by up/down buttons); map pins + route line; per-day Directions links; privacy-notice row for the new storage key (strictly necessary, no banner); E2E + axe in both themes | **IN PROGRESS**: "Add to trip" on places DONE 2026-10-17 (implementation agent, main-session review, `tests/e2e/trip.spec.js` 12/12 desktop + mobile, privacy row + intro). Planner screen (Plan mode, `TripPanel`) DONE 2026-10-17 (`b944637`: implementation agent, fresh-context review approve, 1 medium + 1 low fixed; full E2E green). Map pins + route: DONE and verified 2026-10-17 on `feat/trip-map` (no fixes needed; ready for the owner's review) |
| 2 | Suggestions: nearby places (same and neighbouring districts); route through neighbouring districts | TO DO |
| 3 | Share by link (`?trip=…`, no server) | TO DO |
| 4 | Download PDF (page images + link areas) and Print / Save as PDF | TO DO |

### Agent pattern per slice (owner, 2026-10-17; global CLAUDE.md §4)
| Slice | Implementation | Verification |
|---|---|---|
| Trip domain logic | implementation agent (done) | Fable review |
| Add-to-trip UI | implementation agent | main-session review |
| Trip state integration | implementation agent | focused reviewer |
| Share-link parser | implementation agent | reviewer (parsing untrusted URL data) |
| PDF layout | implementation agent | browser QA, not another coding agent |
| Final combined diff | | one focused code review |

At most 2 active agents, no recursion, the main session verifies every report against the repository, one local
checkpoint commit per green slice.

### Branch plan (owner, 2026-10-17; global CLAUDE.md §2)
```
main
├── feat/trip-planner        planner foundation: place ids, trip logic, Add to trip, planner screen (reviewed checkpoint)
│     └── feat/trip-map      pins + district-level route (branched from feat/trip-planner, not from main)
│           └── feat/trip-drag-reorder   drag to reorder via moveStop() (branched from feat/trip-map @ e2c2ae5)
├── feat/share-trip
├── feat/trip-suggestions
├── feat/trip-pdf
├── refactor/typed-core
├── refactor/runtime-schemas
└── refactor/server-boundaries
```
Each branch is pushed only after the owner's yes for that branch (leak scan first; the repo is public). Merging into
`main` and pushing `main` need separate approval. While features are tightly coupled and unpublished they may build on
the planner branch; independent additions (sharing, PDF, refactors) get their own branches.

### Owner actions
1. **Gemini key:** a key was pasted into the chat on 2026-10-06, so it now sits in local session logs on this shared PC. Delete it
   in Google AI Studio, create a new one, and set it yourself as the user environment variable `GEMINI_API_KEY` (Windows: System
   Properties → Environment Variables → New). Never paste it into chat or files. Check that its project shows the free tier
   (no billing). Then say yes for the Phase 0b run.

### State after the map verification (2026-10-17 22:30, UTC+6)
- **Branch:** `feat/trip-map` at `e2c2ae5`, pushed with the owner's yes (GitHub matches). No code changed since the
  `wip(trip-map)` commit: it passed every check as it was.
- **Map slice:** done and verified (#58). Ready for the owner's review.
- **Step 3, drag to reorder:** done and verified on `feat/trip-drag-reorder` (from `feat/trip-map` @ `e2c2ae5`), commit
  `a4a4979` (#59). Local only: **waiting for the owner's yes to push this branch.** Merging into `main` and deploying wait
  for the owner's yes.
- **Notes for later (unchanged, not bugs):** "In your trip" looks like "Add to trip" apart from its label; phone browsers
  may honour only 3 Maps waypoints; `legDistancesKm` rounds to 10 km.

### State at the 2026-10-17 close (17:36, UTC+6; historical, see above)
- **Branches:** `main` = GitHub `main` = live site = `10df59c` (v2). `feat/trip-planner` = 12 commits on top (the
  foundation; code last verified at `b944637`, then docs only), **pushed to GitHub on 2026-10-17** at the owner's request
  (backup). `feat/trip-map` = branched from `feat/trip-planner` at `341b678`, plus the `wip(trip-map)` commit and this
  handoff commit; also pushed. GitHub CI runs on both; the WIP branch may fail CI until the slice is finished.
- **Map WIP on `feat/trip-map` (the `wip(trip-map)` commit, unverified):** `src/lib/trip.js` (`tripMapData`), `tests/unit/trip.test.js`,
  `src/components/map/BangladeshMap.jsx` (trip overlay group), `src/components/map/MapLegend.jsx` (Plan legend),
  `src/components/game/GameBoard.jsx`, `src/components/trip/TripPanel.jsx` (phone "Show on map"), `src/styles/index.css`
  (`.trip-overlay`), new `tests/e2e/trip-map.spec.js`; about 217 lines added. The agent's last note: the visuals looked
  right, including over a selected district; it was about to run its final checks.
- **Resume the map slice:**
  1. `git show --stat` and the diff of the `wip(trip-map)` commit on `feat/trip-map`. Confirm `BangladeshMap.jsx` only gained the optional overlay prop and a
     non-interactive `<g className="trip-overlay" aria-hidden="true">` (no handler, tabindex or keyboard change). If it changed
     more, use one fresh-context reviewer for map interaction and accessibility.
  2. Run, one at a time: `npm run lint`; `npx vitest run`; `npm run build`;
     `npx playwright test tests/e2e/trip-map.spec.js --workers=1`;
     `npx playwright test tests/e2e/planner.spec.js tests/e2e/discovery.spec.js tests/e2e/accessibility.spec.js tests/e2e/quiz.spec.js --project=desktop --workers=1`;
     `npx playwright test tests/e2e/planner.spec.js tests/e2e/discovery.spec.js --project=mobile --workers=1`.
  3. Fix from the exact diagnostics (an implementation agent if it is more than a few lines), look at desktop and phone in
     light and dark, then commit the fixes locally on top. Do not rewrite the pushed history (a force-push needs the owner's
     yes); pushing the new commits needs the owner's yes too.
  4. If the WIP looks wrong: `git revert` the `wip(trip-map)` commit locally and rerun the slice from the spec in #57.
- **Decided:** on phones the planner comes first, with "Show on map" under it. Merging into `main` waits for the owner.
- **Local only (deliberately not on GitHub):** `.dev.vars` (the secret pepper; a fresh local one can be generated, see section
  6; the production pepper is in the owner's password manager); `/reference/` (copyrighted books, never publish);
  `skill_review.md`, `docs/claude-skill-audit.md` and `.claude/` (local only by the owner's 2026-09-28 decision);
  `brag-output/` (the launch video and its 224 MB of regenerable frames; the owner decides whether the video goes anywhere);
  `node_modules/`, `dist/`, `.wrangler/`, `test-results/` (regenerate with `npm ci`, `npm run build`, `npm run db:migrate:local`).
- **Notes for later (not bugs):** "In your trip" looks like "Add to trip" apart from its label (polish); phone browsers may
  honour only 3 Maps waypoints (browser QA); `legDistancesKm` rounds to 10 km (say "about" if distances are shown); optional
  test ideas from the trip-logic review.
- **Process used:** one implementation agent per slice → machine checks → review (Fable for risky state, the main session for
  plain UI) → main-session diff check and full rerun → local commit. `karpathy-guidelines` applied as the simplicity rule.

### Next steps (in order; heavy jobs one at a time)
1. DONE 2026-10-17: `brag-output/` is ignored by ESLint and git, so `npm run lint` is green. Work moved to the local branch
   `feat/trip-planner`; the short current state now lives in `docs/ai/CURRENT.md` (map of the code: `docs/ai/INDEX.md`).
2. DONE 2026-10-17: Fable review of the trip logic (2 findings fixed) and "Add to trip" on places.
3. Owner's roadmap (2026-10-17), one verified slice at a time on feature branches (see the branch plan):
   1. Planner screen: days, stops, remove, up/down, one Google Maps link per day, empty state, clear trip (DONE
      2026-10-17, `b944637`).
   2. Map: pins for the stops and a route line derived from the trip (DONE 2026-10-17 on `feat/trip-map`: verified with no
      fixes needed; awaiting the owner's review).
   3. Drag to reorder, reusing `moveStop()` (no separate reorder logic) (DONE 2026-10-17 on `feat/trip-drag-reorder`,
      `a4a4979`; local, awaiting the owner's push decision).
   4. Share by link: `?trip=…`; validate the untrusted data, reject malformed or oversized payloads.
   5. Suggestions: nearby places and neighbouring-district route ideas.
   6. Bengali enrichment: optional, only with a fresh Gemini key and the owner's yes for that run.
   7. PDF / print: browser-generated itinerary, Bengali preserved, clickable Directions links.
   8. Final review: code review, accessibility, browser testing, security/privacy check, leak scan, docs. Then stop and ask
      the owner before anything touches `main` or production.
4. Then architecture hardening, each on its own branch: `refactor/typed-core` (incremental TypeScript),
   `refactor/runtime-schemas` (Zod at trust boundaries, after dependency approval), `refactor/server-boundaries`
   (middleware → protected policy → services → repositories → D1). No billing, organisations, elaborate RBAC, feature-flag
   service or audit database without a real product need.
