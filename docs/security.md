# Security

For the site owner and future maintainers. How the site is protected, what was reviewed, and what to do if something goes wrong.

## 1. Attack surface

| Surface | Exposure |
|---|---|
| Static site (HTML, JS, CSS, fonts, SVG) | Public, read-only, served by Cloudflare Pages |
| `/api/*` (Pages Functions) | Public: sign-up, sign-in, sign-out, "who am I", add/reset stamps, delete account |
| D1 database | Reachable only from the Functions via the `DB` binding, never directly from the internet |
| Secrets | `AUTH_PEPPER` (Cloudflare secret; `.dev.vars` locally, gitignored) |
| Browser storage | `localStorage`: guest stamp ids, theme, the quiz best score and the trip plan's stop ids (written only after the first "Add to trip"; never sent to the server) only. One HttpOnly session cookie after sign-in |
| Shared trip links | A `?trip=` link holds place and district ids only. It is untrusted: checked whole against the local data before any of it is used, rejected (never repaired) if anything is wrong, and only previewed until the user saves it; no text from the link is shown |
| Third parties | None at runtime: no analytics, ads, CDNs, fonts or auth SDKs. A place's Directions link opens Google Maps in a new tab only when the user chooses it; no map is embedded |

## 2. Threat model (STRIDE, per *Security Engineering* 3rd ed., §27.3.5)

| Threat | Example | Mitigation |
|---|---|---|
| **Spoofing** | Guessing a password; stealing a session | Browser PBKDF2-SHA256 600k + server HMAC with a secret pepper; failed-guess limits per user+network and per user; 256-bit session tokens, stored only as SHA-256; `__Host-` HttpOnly Secure SameSite=Strict cookie |
| **Tampering** | Forged requests from another site; injected content | Origin check + JSON-only on state changes (CSRF); parameterised SQL everywhere; content validator rejects markup; district ids whitelisted 1 to 64; a shared trip link is validated whole and only previewed until saved |
| **Repudiation** | Low stakes (a game) | No audit log by design (privacy); sessions expire in 30 days |
| **Information disclosure** | Leaked database; account enumeration | Database holds no passwords, emails or raw IPs; identical sign-in error for wrong password and unknown user; `no-store` on API responses; strict CSP |
| **Denial of service** | Lockout flooding; storage fill; big bodies; write-quota floods | Only *failed* guesses count, per network, so an attacker can't lock the owner out elsewhere; max 10 sessions per user; 2 KB body cap checked from `Content-Length`; the free-plan firewall (section 5); Cloudflare free-plan limits fail closed instead of billing |
| **Elevation of privilege** | Acting on another account | Every API route derives the user from the session cookie, never from the request body |

## 3. Secure development lifecycle (mapped to *Security Engineering* §27.5.3)

| SDL phase | What this project did |
|---|---|
| Requirements | Zero budget, small audience, no personal data beyond a username; guests need no account |
| Design | Threat model above; attack surface kept same-origin; *Privacy's Blueprint* (Hartzog) standards: no deceptive, abusive or dangerous design (opt-in merges on sign-in, unticked consent box, no confirmshaming) |
| Implementation | Exact-pinned dependencies (3 runtime), lockfile, ESLint with the React Compiler rules, no `dangerouslySetInnerHTML`/`eval`, no inline scripts or styles |
| Verification | Unit tests (auth helpers, validators, storage hardening, token contrast), API smoke test (29 checks incl. CSRF, rate limits, 413), E2E that fails on any CSP violation, axe WCAG 2.2 AA scans, code review (10 findings fixed), security review (3 findings fixed) |
| Release | This document's incident-response plan; secrets set with `wrangler pages secret put`, never committed |

### Reviews performed
- **Code review:** 10 findings, all fixed. Among them: a login-lockout DoS, account deletion as an unlimited password oracle,
  and guest stamps deleted before the server confirmed a merge.
- **Security review (manual, OWASP-style):** fixed a SQL `LIKE` wildcard risk, oversized body handling and unbounded
  sessions.
- **v2 round (2026-10-05):** a read-only security audit found F1 (rate-limited requests still wrote D1 rows; fixed by the
  firewall in section 5) and F2 (accepted, section 5). Then a code review (4 findings: a quiz crash after the round ended,
  false 429s from counting `GET /api/me` behind shared IPs, the honeypot, phone quiz tab order) and a security review
  (5 findings: IPv6 grouped by /64, the honeypot renamed to `hp_note`, the burst race accepted, privacy retention wording,
  1 info). All fixed or accepted; `npm audit` 0.

## 4. Security headers (`public/_headers`)

`Content-Security-Policy: default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; font-src 'self';
connect-src 'self'; object-src 'none'; base-uri 'self'; form-action 'none'; frame-ancestors 'none'; upgrade-insecure-requests`,
plus `X-Content-Type-Options`, `X-Frame-Options: DENY`, `Referrer-Policy`, `Permissions-Policy`, COOP, CORP and HSTS.
The theme runs before first paint from an external file (`/theme-init.js`) so the CSP needs no `'unsafe-inline'`.
If you add a custom domain later: HSTS `includeSubDomains` then applies to all its subdomains, so keep them all on HTTPS.

## 5. Firewall on the free plan

The site runs on `*.pages.dev`, which has no Cloudflare zone, so WAF rules, rate-limiting rules, Bot Fight Mode and the Workers
rate-limit binding are not available. The protection lives in `functions/api/`, cheapest check first:

| Layer | Where | What it does |
|---|---|---|
| Method allowlist | `functions/api/_middleware.js` | Only GET, POST and DELETE reach the API; anything else gets 405 |
| Per-IP pre-filter | `functions/api/_middleware.js` | About 60 POST or DELETE requests a minute per `CF-Connecting-IP` (IPv6 per /64), counted in memory per isolate (no D1), then 429. GET is not counted (`/api/me` runs on every page load and many users can share one IP). Loopback and requests without the header (local dev, tests) are not counted |
| Origin and JSON checks | `functions/api/_middleware.js` | State changes must come from this origin, as JSON (CSRF) |
| D1 rate limits | `server/auth.js` | Sign-up 5 per network per hour, sign-in 30 per network per 15 minutes, failed-guess caps. A blocked request only reads, so a flood cannot spend the 100k daily row writes |
| Sign-up honeypot | `AuthDialog.jsx`, `functions/api/auth/signup.js` | A hidden `hp_note` field (a name browsers do not autofill). If it is filled, the reply looks like success, but nothing is stored and no cookie is set |

**Why not WAF or Turnstile:** a pages.dev site has no zone to attach WAF rules to, and Turnstile would add a third-party request,
and data sharing with Cloudflare's challenge service, to a site that otherwise has none.

**Residual risk:** the pre-filter counts per isolate and per IP, so a distributed flood can still use up the 100k Functions requests
a day. The fallback is a custom domain plus the free WAF rate-limiting rule, or Turnstile on sign-up if spam appears.
Sign-up answers 409 for a taken username, which reveals that it exists (audit F2). Accepted: usernames are pseudonyms that are
never shown to anyone, and sign-up is limited to 5 per network per hour.
Burst race (accepted): the D1 limits read, then write, so parallel requests that all read below a limit each write once per window.

## 6. Known limits (accepted for v1)

- **No password reset.** There is no email on file. This is stated at sign-up and in the terms. Recommended v2: passkeys.
- **Pepper rotation** is not supported: changing `AUTH_PEPPER` invalidates every password. Keep it secret and stable.
- **Housekeeping** (expired sessions, old counters) runs on about 1 in 20 allowed sign-ins and sign-ups, because Pages Functions
  have no scheduled jobs.
  Counters store only HMACs.
- **Spam sign-ups** are limited to 5 per network per hour. If abuse appears, add Cloudflare Turnstile (free, but it needs a CSP change).

## 7. Incident response (PICERL, per the *Blue Team Handbook*)

| Phase | What to do here |
|---|---|
| **Preparation** | 2FA on the Cloudflare (and GitHub) accounts; know where the D1 dashboard and Time Travel are; keep this file |
| **Identification** | Signs: unusual sign-up counts, 429/500 spikes in Cloudflare analytics, unexpected content on the site |
| **Containment** | Roll back to the previous Pages deployment in the dashboard; if the API is abused, remove the `DB` binding or the `AUTH_PEPPER` secret (the API then fails closed with 503) |
| **Eradication** | Fix the cause in code; rotate the Cloudflare API token; if the pepper leaked, rotate it (all users must re-register) |
| **Recovery** | `npx wrangler d1 time-travel restore bd-discovery-passport --timestamp=<unix time>` (free plan: last 7 days) |
| **Lessons learned** | Add a test that reproduces the issue; update this file |
