# Bangladesh Discovery Passport: progress log

> **Resuming in a new session?** Tell Claude: *"Read PROGRESS.md and continue."*
> This file is the handoff: what is done, which skill and approach each task used, what is left and with which
> skills, the approach audit, and how to run everything. Updated at every milestone.

**Last updated:** 2026-09-28, milestone 27: build complete and verified locally. Docs written, CI file ready (not committed).
**Waiting on the owner** for deployment (Cloudflare login, contact details) and the optional GitHub decision.

Skill status words (from the brief): **APPLIED** (actually used and changed the work), **AVAILABLE** (installed, not yet
used), **NOT NEEDED** (considered, deliberately skipped, with reason), **UNAVAILABLE** (cannot be used in this session).

**Rough completion: about 93%.** Everything that can be done without your logins is done. Product features are done; what remains is mostly verification, reviews, docs and deployment.

---

## 1. Overall status

| Area | State |
|---|---|
| Phase 0: device skill scan, dedupe, global install, project skills | DONE |
| Phase 0B: MCP / plugin audit | DONE (write-up still to go into docs/project-skills.md) |
| Phase 0C: reference books (5 original + *Privacy's Blueprint*, added by the user) | DONE (notes still to go into docs/security.md) |
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
| Docs + CI file | DONE: README + 7 docs; `.github/workflows/ci.yml` written, not committed |
| Final verification | DONE: lint clean, 57 unit, API smoke 3/3 runs, 37 E2E, map data deterministic |
| Deploy | **WAITING ON YOU** (see section 3) |
| **User rule** | Never commit or push without asking (saved to memory). GitHub is optional: Cloudflare direct upload works without it |

---

## 2. Done: task → skill → approach

| # | Task | Skill(s) used (status) | Approach and evidence |
|---|---|---|---|
| 1 | Scan C:\ and D:\ for skills | none (shell + Node) | `dir /s /b` for SKILL.md, then a Node script: frontmatter parse, SHA-256 of SKILL.md and of the whole directory, ecosystem from path. 692 files, 418 unique, 274 exact duplicates, 23 name collisions. |
| 2 | Classify compatibility | none (manual reading) | Read sample SKILL.md files from every family; rules: COMPATIBLE / COMPATIBLE* (needs MCP) / REQUIRES ADAPTATION / INCOMPATIBLE. Verified the global dir via official docs (`~/.claude/skills/<name>/SKILL.md`). |
| 3 | Install globally (283 skills) | none | Copy, never move; backup manifest + rollback script in `C:\Users\VICTUS\.claude\backups\skill-install-2026-09-28\`. Collisions renamed `<source>-<skill>` including the frontmatter `name`. **Verified live** (the session announced the new skills without a restart). Side effect: past ~110 skills the listing drops descriptions. |
| 4 | Security plugin | `claude-security` | Installed via `claude plugin install`. **UNAVAILABLE in this session** (plugins load at session start); use next session. |
| 5 | Project skill library | none | 21 skills in `.claude/skills/`; impeccable's 16 MB .exe gitignored. Report: `docs/claude-skill-audit.md`. |
| 6 | Engineering approach | `andrej-karpathy-skills:karpathy-guidelines` (**APPLIED**, Stage A) | Stated assumptions, verify-steps per task, exact-pinned deps, fail-loud pipeline, removed speculative helpers, no UI library. |
| 7 | Visual direction | `design-taste-frontend` (**APPLIED**), then `high-end-visual-design` (**APPLIED selectively**) (Stage B) | Design read + dials (6/4/3); client palette kept via the skill's override; em-dash ban; eyebrow restraint; passport "cover + page"; rejected glass nav, giant radii, scroll reveals. |
| 8 | UI library decision | `pick-ui-library` (**UNAVAILABLE**: user-invocation only) | Brief's Stage D rule: React + Tailwind + native `<dialog>`/popover; no component or icon library. |
| 9 | Reference image reconstruction | `image-to-code` (**NOT NEEDED**) | No mockups supplied. |
| 10 | Geo pipeline | none (d3-geo, topojson-*) | 419 repo-id joins, 118 orphans by ADM2 point-in-polygon, **7 upstream mis-joins fixed** via reviewed `data/source/corrections.json`, shared-arc simplify (25%) + merge, Transverse Mercator 90°E, compact paths. 521 KB → 136 KB. |
| 11 | Data validation | `data:validate-data` (**NOT NEEDED**: it QA's analyses) | `scripts/validate-map-data.mjs` before every build: ids, joins, bbox, neighbours, stamp codes, https sources, no markup, no dashes. |
| 12 | Content verification | none | UNESCO first, Wikipedia secondary (Banglapedia blocked). Claims never exceed the source. |
| 13 | Map, card, stamp, gazetteer | karpathy + design-taste (APPLIED) | Inline SVG, roving tabindex + spatial arrows, overlays for hover/selection/focus, hatched vs solid (not colour alone), SVG-filter stamp. |
| 14 | Browser QA | `chrome-devtools` (**UNAVAILABLE** this session; `.mcp.json` added) | Playwright scripts: screenshots at 375/430/768/1024/1440, console errors, overflow. |
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

---

## 3. Still to do

### Needs you (nothing else is blocking)
| # | Task | What you do | What Claude does after |
|---|---|---|---|
| 1 | Cloudflare account | Create a free account, turn on 2FA, run `npx wrangler login` in this folder | Create D1, apply migrations, set the `AUTH_PEPPER` secret, deploy (`docs/deployment.md`), run the smoke test against the live URL |
| 2 | Contact details | Give a contact email or public link for the privacy notice | Fill `TODO(site owner)` in `privacy/index.html` |
| 3 | GitHub (optional) | Say yes or no; if yes, give your GitHub noreply email | Commit (with your OK), push, CI runs `.github/workflows/ci.yml` |

### Optional extras
| Task | Skill / approach | Note |
|---|---|---|
| Deep security scan | `claude-security` (AVAILABLE) | Multi-agent; uses a lot of your usage allowance |
| Final motion review | `/review-animations` (you run it) | User-invoke only |
| UI library second opinion | `/pick-ui-library` (you run it) | User-invoke only; current answer: none needed |
| Product context for design tools | `/impeccable init` (writes PRODUCT.md) | Helps future design passes |
| Update impeccable | `npx impeccable update` | v4.4.0 available; only if you want it |
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
| Abuse protection | D1 rate limits | Cloudflare Turnstile; WAF rule | **Keep**; Turnstile only if spam appears. |
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

## 6. How to run

```bash
npm install
npm run build:map               # regenerate map data (only when sources change)
npm run validate:data
npm run dev                     # UI only at http://127.0.0.1:5173 (accounts show "unavailable")
npm run db:migrate:local        # first time: create the local D1 tables
npm run dev:full                # build + wrangler pages dev at http://127.0.0.1:8788 (UI + accounts + headers)
npm run test:api                # API smoke test against dev:full
npx playwright test             # E2E (starts wrangler itself if nothing is running)
```

Local secret: `.dev.vars` contains `AUTH_PEPPER=<random>` (gitignored; regenerate with
`node -e "console.log(require('crypto').randomBytes(32).toString('base64url'))"`).
