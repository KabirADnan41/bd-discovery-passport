# Skill usage log

Only skills that materially changed the project are logged, in the brief's format. Skills that were available but not
needed are listed in `docs/project-skills.md`.

---
**Skill:** karpathy-guidelines
**Exact installed name:** `andrej-karpathy-skills:karpathy-guidelines`
**Source:** forrestchang/andrej-karpathy-skills (claude.ai synced plugin)
**Stage:** A, engineering approach (throughout)
**Reason:** avoid over-engineering; verify assumptions before building
**Files affected:** `scripts/build-district-map.mjs`, `src/components/map/BangladeshMap.jsx`, `package.json`
**Recommendation applied:** checked the source data before trusting it (found 118 unjoined and 7 mis-joined polygons);
fail-loud pipeline with pinned hashes; exact-pinned dependencies (3 runtime); removed a speculative `useStable` helper;
no UI or icon library.
**Result:** a pipeline that refuses bad data; a small dependency tree (0 vulnerabilities).

---
**Skill:** design-taste-frontend
**Exact installed name:** `design-taste-frontend`
**Source:** Leonxlnx/taste-skill
**Stage:** B, initial visual direction; L, responsive
**Reason:** prevent a generic AI/Tailwind look
**Files affected:** `src/styles/tokens.css`, `src/styles/index.css`, `src/components/game/GameBoard.jsx`
**Recommendation applied:** design read and dials (variance 6, motion 4, density 3); the client palette kept via the
skill's explicit brand override with locked roles; no photography (honest deviation); em-dash ban (the validator enforces
it on content); single accent; map-dominant asymmetric layout.
**Result:** the parchment-atlas identity; the map is the hero.

---
**Skill:** high-end-visual-design
**Exact installed name:** `high-end-visual-design`
**Source:** Leonxlnx/taste-skill
**Stage:** B, after design-taste
**Reason:** raise the polish
**Files affected:** `src/styles/index.css`, `src/components/district/DistrictCard.jsx`
**Recommendation applied:** the double-bezel idea as a passport booklet (green cover + paper page with concentric radii);
tinted diffuse shadows; custom easing. Rejected as the brief requires: glass nav, `rounded-[2rem]` cards, pill eyebrows,
scroll reveals.
**Result:** the passport page reads as a physical passport.

---
**Skill:** find-animation-opportunities → animation-vocabulary → animate
**Exact installed names:** `find-animation-opportunities`, `animation-vocabulary`, `animate`
**Source:** emilkowalski/skill
**Stage:** G, motion
**Reason:** add motion only where it means something
**Files affected:** `src/styles/index.css`, `src/styles/tokens.css`, `src/hooks/usePresence.js`,
`src/components/map/DistrictTooltip.jsx`, `src/components/game/DiscoveryProgress.jsx`, `src/components/ui/Modal.jsx`
**Recommendation applied:** 5 of 10 candidates kept (symmetric sheet exit, dialog and origin-aware menu transitions,
a tooltip that enters once, the ledger tick after the stamp); `--ease-out` set to `cubic-bezier(0.23, 1, 0.32, 1)`;
reduced motion made "gentler, not zero".
**Result:** browser-verified in normal and reduced-motion modes.

---
**Skill:** improve-animations
**Exact installed name:** `improve-animations`
**Source:** emilkowalski/skill
**Stage:** H
**Files affected:** `src/styles/index.css`, `src/styles/tokens.css`, `src/components/game/GameBoard.jsx`
**Recommendation applied:** reduced-motion gating on stamp thumbnails; press feedback 160 ms on the shared curve; `ease`
for colour changes; a single movement inside the mobile sheet.
**Result:** consistent easing, no stray tokens.

---
**Skill:** emil-design-eng
**Exact installed name:** `emil-design-eng`
**Source:** emilkowalski/skill
**Stage:** I, interaction feel
**Files affected:** `src/components/district/DistrictCard.jsx`, `src/lib/sheetGesture.js`, `src/styles/index.css`
**Recommendation applied:** drag-to-dismiss sheet (velocity > 0.11 px/ms or 30% of height, pointer capture, upward
friction, transform set directly); instant `:active` press on districts without scaling.
**Result:** browser-verified: a slow drag snaps back, a flick dismisses.

---
**Skill:** web-design-guidelines
**Exact installed name:** `web-design-guidelines`
**Source:** vercel-labs/agent-skills (rules fetched fresh)
**Stage:** K, accessibility
**Files affected:** `DistrictCard.jsx`, `AuthDialog.jsx`, `DeleteAccountDialog.jsx`, `PassportMenu.jsx`, `GameBoard.jsx`,
`districtData.js`, `useDiscoveryState.js`, `index.css`
**Recommendation applied:** removed `outline-none` without a replacement; long-name overflow; `Intl.NumberFormat('bn-BD')`;
input names; focus the first form error; overscroll containment; sync errors announced; `text-balance`; `translate="no"`;
safe areas; deep links (`?district=`).
**Result:** axe WCAG 2.2 AA clean in both themes (after one contrast fix found by the tests).

---
**Skill:** code-review (built-in)
**Stage:** R
**Files affected:** `GameBoard.jsx`, `useAccount.js`, `PassportMenu.jsx`, `functions/api/auth/login.js`,
`functions/api/account.js`, `server/auth.js`, `privacy/index.html`, `package.json`
**Recommendation applied:** all 10 findings (see `docs/security.md`).
**Result:** all suites green again.

---
**Skill:** simplify (built-in)
**Stage:** S
**Files affected:** new `src/hooks/usePassportSync.js`, `shared/credentials.js`; `useDiscoveryState.js`, `useAccount.js`,
`GameBoard.jsx`, `PassportMenu.jsx`, `DistrictCard.jsx`, `server/auth.js`, `functions/api/account.js`
**Recommendation applied:** account sync owned by one hook; the passport source in the reducer; no cross-component DOM
queries; shared credential rules; fewer D1 round trips.
**Result:** 57 unit tests, API smoke and 37 E2E tests green.

---
**Skill:** impeccable
**Exact installed name:** `impeccable` (v4.3.1)
**Stage:** T, final polish
**Files affected:** `DistrictCard.jsx`, `index.css`, `policy.css`, `privacy/index.html`, `terms/index.html`
**Recommendation applied:** craft-floor bans (eyebrows above headings, glyph-as-icon); themed browser surfaces; the
detector's one finding (thick border on rounded sheet corners) fixed by making the sheet a concentric passport cover.
**Result:** one clean batched inspection round (desktop + mobile, light + dark).

---
**Skill:** minimalist-ui
**Exact installed name:** `minimalist-ui`
**Stage:** V, clutter diagnostic (lens only)
**Files affected:** `DistrictCard.jsx`
**Recommendation applied:** removed a redundant disclosure sentence. The atlas character was kept on purpose.
**Result:** no further clutter found.
