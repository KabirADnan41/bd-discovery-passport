# Bangladesh Discovery Passport

*Explore Bangladesh, one district at a time.* বাংলাদেশ আবিষ্কারের পাসপোর্ট

An interactive atlas of Bangladesh's 64 districts. Choose a district to open its bilingual passport page and collect its
stamp. Play as a guest (stamps stay in your browser) or create a free account so your passport is kept separate from
anyone else on your device and follows you to other devices.

- Inline SVG map built at compile time from official-source boundaries (no map library, no tiles)
- English + বাংলা throughout, light and dark themes, keyboard and screen-reader friendly
- Landmark and culture notes only where checked against a source (UNESCO first); other districts say so honestly
- Free to run on Cloudflare Pages + Functions + D1: no servers, no ads, no tracking

## Run it

```bash
npm install
npm run dev                  # UI only: http://127.0.0.1:5173 (accounts show as unavailable)

# Full stack (UI + accounts API + local database + real security headers):
node -e "require('fs').writeFileSync('.dev.vars','AUTH_PEPPER='+require('crypto').randomBytes(32).toString('base64url')+'\n')"
npm run db:migrate:local
npm run dev:full             # http://127.0.0.1:8788
```

## Check it

```bash
npm run lint
npm test                     # unit tests (Vitest)
npm run test:api             # API smoke test against dev:full
npx playwright test          # E2E + accessibility + CSP (desktop and phone)
node scripts/measure-performance.mjs
```

## Deploy

See [docs/deployment.md](docs/deployment.md). Only a Cloudflare login is needed; GitHub is optional.

## Documentation

| Doc | What it covers |
|---|---|
| [PROGRESS.md](PROGRESS.md) | Status, which skill did what, what is left, the approach audit |
| [docs/architecture.md](docs/architecture.md) | How the pieces fit, key flows, the design system |
| [docs/data-sources.md](docs/data-sources.md) | Sources, the 64-district pipeline, data problems found upstream |
| [docs/security.md](docs/security.md) | Threat model, reviews, headers, incident response |
| [docs/design-research.md](docs/design-research.md) | References studied and what was (not) adopted |
| [docs/deployment.md](docs/deployment.md) | Free hosting setup and every-deploy steps |
| [docs/project-skills.md](docs/project-skills.md), [docs/skill-usage-log.md](docs/skill-usage-log.md), [docs/claude-skill-audit.md](docs/claude-skill-audit.md) | Claude Code skills: inventory, selection, usage |

## Credits and licences

Boundaries: [geoBoundaries](https://www.geoboundaries.org/) gbOpen ADM2/ADM3, CC BY 4.0 (authority BBS / OCHA ROAP), via
[ifahimreza/bangladesh-geojson](https://github.com/ifahimreza/bangladesh-geojson) (MIT). Typeface: Anek Bangla by Ek Type,
SIL Open Font License. The map is for learning and play, not an official boundary map.
