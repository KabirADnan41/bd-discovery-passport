# Deployment (free, 24/7, nothing running on your PC)

**What you need:** a free Cloudflare account. **GitHub is optional.** Cloudflare Pages accepts a direct upload from this
folder. Nothing is committed or pushed without your explicit OK.

## One-time setup

Steps marked **you** need your login; Claude can run the rest once you are logged in.

1. **You:** create a free Cloudflare account and turn on two-factor authentication (Profile → Authentication).
2. **You:** in this folder, run `npx wrangler login` and approve in the browser.
3. Create the database:
   ```bash
   npx wrangler d1 create bd-discovery-passport
   ```
   Copy the printed `database_id` into `wrangler.toml`, replacing `00000000-0000-0000-0000-000000000000`.
4. Create the tables:
   ```bash
   npx wrangler d1 migrations apply bd-discovery-passport --remote
   ```
5. Create the Pages project and its secret (the pepper must stay secret and must never change, or every password breaks):
   ```bash
   npx wrangler pages project create bd-discovery-passport --production-branch main
   node -e "console.log(require('crypto').randomBytes(32).toString('base64url'))"
   npx wrangler pages secret put AUTH_PEPPER --project-name bd-discovery-passport   # paste the value when asked
   ```
   Keep a copy of the pepper somewhere private (a password manager).
6. **You:** add a contact email or link to `privacy/index.html` (search for `TODO(site owner)`).

## Every deploy

```bash
npm ci
npm run build          # validates the data, then builds dist/
npx wrangler pages deploy dist --project-name bd-discovery-passport
```

Wrangler uploads `dist/` plus `functions/` and prints the live URL (`https://bd-discovery-passport.pages.dev`).
`_headers` (the CSP etc.) is applied automatically.

## Checks after deploying

```bash
curl -sI https://bd-discovery-passport.pages.dev/ | grep -i content-security-policy
node tests/api/smoke.mjs https://bd-discovery-passport.pages.dev   # creates and deletes a test account
```

Then open the site, discover a district, create an account, sign out and back in, and switch the theme.

## Free-plan limits (checked 2026-09-28)

- Workers/Functions: 100,000 requests per day, 10 ms CPU per request. Passwords are stretched in the browser so sign-in fits.
- D1: 5 GB total (500 MB per database), 5 million rows read and 100,000 written per day.
- Over a limit, requests of that type fail for the rest of the day. **No charges are possible on the free plan.**
- Backups: D1 Time Travel restores to any minute in the last 7 days (see `docs/security.md`).

## Optional: GitHub + CI

`.github/workflows/ci.yml` runs lint, unit tests, a map-data drift check, the build and the E2E suite on every push. Using it
needs a GitHub repository and your OK to commit and push. Use your GitHub "noreply" email for commits, so your personal
address never becomes public. The `/reference/` books are gitignored and must never be published.
