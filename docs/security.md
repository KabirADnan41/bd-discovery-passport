# Security

For the site owner and future maintainers. How the site is protected, what was reviewed, and what to do if something goes wrong.

## 1. Attack surface

| Surface | Exposure |
|---|---|
| Static site (HTML, JS, CSS, fonts, SVG) | Public, read-only, served by Cloudflare Pages |
| `/api/*` (Pages Functions) | Public: sign-up, sign-in, sign-out, "who am I", add/reset stamps, delete account |
| D1 database | Reachable only from the Functions via the `DB` binding, never directly from the internet |
| Secrets | `AUTH_PEPPER` (Cloudflare secret; `.dev.vars` locally, gitignored) |
| Browser storage | `localStorage`: guest stamp ids + theme only. One HttpOnly session cookie after sign-in |
| Third parties | None at runtime: no analytics, ads, CDNs, fonts or auth SDKs |

## 2. Threat model (STRIDE, per *Security Engineering* 3rd ed., §27.3.5)

| Threat | Example | Mitigation |
|---|---|---|
| **Spoofing** | Guessing a password; stealing a session | Browser PBKDF2-SHA256 600k + server HMAC with a secret pepper; failed-guess limits per user+network and per user; 256-bit session tokens, stored only as SHA-256; `__Host-` HttpOnly Secure SameSite=Strict cookie |
| **Tampering** | Forged requests from another site; injected content | Origin check + JSON-only on state changes (CSRF); parameterised SQL everywhere; content validator rejects markup; district ids whitelisted 1 to 64 |
| **Repudiation** | Low stakes (a game) | No audit log by design (privacy); sessions expire in 30 days |
| **Information disclosure** | Leaked database; account enumeration | Database holds no passwords, emails or raw IPs; identical sign-in error for wrong password and unknown user; `no-store` on API responses; strict CSP |
| **Denial of service** | Lockout flooding; storage fill; big bodies | Only *failed* guesses count, per network, so an attacker can't lock the owner out elsewhere; max 10 sessions per user; 2 KB body cap checked from `Content-Length`; Cloudflare free-plan limits fail closed instead of billing |
| **Elevation of privilege** | Acting on another account | Every API route derives the user from the session cookie, never from the request body |

## 3. Secure development lifecycle (mapped to *Security Engineering* §27.5.3)

| SDL phase | What this project did |
|---|---|
| Requirements | Zero budget, small audience, no personal data beyond a username; guests need no account |
| Design | Threat model above; attack surface kept same-origin; *Privacy's Blueprint* (Hartzog) standards: no deceptive, abusive or dangerous design (opt-in merges on sign-in, unticked consent box, no confirmshaming) |
| Implementation | Exact-pinned dependencies (3 runtime), lockfile, ESLint with the React Compiler rules, no `dangerouslySetInnerHTML`/`eval`, no inline scripts or styles |
| Verification | Unit tests (auth helpers, validators, storage hardening, token contrast), API smoke test (30+ checks incl. CSRF, rate limits, 413), E2E that fails on any CSP violation, axe WCAG 2.2 AA scans, built-in code review (10 findings fixed), manual security review (3 findings fixed) |
| Release | This document's incident-response plan; secrets set with `wrangler pages secret put`, never committed |

### Reviews performed
- **Code review (built-in `code-review`, high):** 10 findings, all fixed. Among them: a login-lockout DoS, account deletion as an
  unlimited password oracle, and guest stamps deleted before the server confirmed a merge.
- **Security review:** the built-in `security-review` needs a git remote, so a manual OWASP-style pass was done instead. Fixed:
  SQL `LIKE` wildcard risk, oversized body handling, unbounded sessions.
- **Optional deep scan:** the `claude-security` plugin is installed and can run a multi-agent scan. It is heavy on usage, so
  run it when convenient.

## 4. Security headers (`public/_headers`)

`Content-Security-Policy: default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; font-src 'self';
connect-src 'self'; object-src 'none'; base-uri 'self'; form-action 'none'; frame-ancestors 'none'; upgrade-insecure-requests`,
plus `X-Content-Type-Options`, `X-Frame-Options: DENY`, `Referrer-Policy`, `Permissions-Policy`, COOP, CORP and HSTS.
The theme runs before first paint from an external file (`/theme-init.js`) so the CSP needs no `'unsafe-inline'`.
If you add a custom domain later: HSTS `includeSubDomains` then applies to all its subdomains, so keep them all on HTTPS.

## 5. Known limits (accepted for v1)

- **No password reset.** There is no email on file. This is stated at sign-up and in the terms. Recommended v2: passkeys.
- **Pepper rotation** is not supported: changing `AUTH_PEPPER` invalidates every password. Keep it secret and stable.
- **Housekeeping** (expired sessions, old counters) runs on sign-in and sign-up, because Pages Functions have no scheduled jobs.
  Counters store only HMACs.
- **Spam sign-ups** are limited to 5 per network per hour. If abuse appears, add Cloudflare Turnstile (free, but it needs a CSP change).

## 6. Incident response (PICERL, per the *Blue Team Handbook*)

| Phase | What to do here |
|---|---|
| **Preparation** | 2FA on the Cloudflare (and GitHub) accounts; know where the D1 dashboard and Time Travel are; keep this file |
| **Identification** | Signs: unusual sign-up counts, 429/500 spikes in Cloudflare analytics, unexpected content on the site |
| **Containment** | Roll back to the previous Pages deployment in the dashboard; if the API is abused, remove the `DB` binding or the `AUTH_PEPPER` secret (the API then fails closed with 503) |
| **Eradication** | Fix the cause in code; rotate the Cloudflare API token; if the pepper leaked, rotate it (all users must re-register) |
| **Recovery** | `npx wrangler d1 time-travel restore bd-discovery-passport --timestamp=<unix time>` (free plan: last 7 days) |
| **Lessons learned** | Add a test that reproduces the issue; update this file |

## 7. Reference books and how they were used

- *Security Engineering* 3rd ed. (Anderson): threat modelling (§27.3.5), SDL (§27.5.3), DevSecOps (§27.5.6).
- *Blue Team Handbook: Incident Response Edition* (Murdoch): the PICERL phases above.
- *Privacy's Blueprint* (Hartzog): trust, obscurity and autonomy; deceptive, abusive and dangerous design standards.
- *Cybersecurity For Dummies*: account hygiene (multi-factor authentication for the hosting accounts).
- *The Cuckoo's Egg* and *Linux Basics for Hackers*: background only; nothing version-specific was taken from older books.
  Current configuration was checked against Cloudflare, OWASP and browser documentation instead.
