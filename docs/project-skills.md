# Project skills

Skills copied into `.claude/skills/` (project-local) for this site, plus the built-in and plugin skills the workflow uses.
All project-local copies are also installed globally in `C:\Users\VICTUS\.claude\skills\` (see `docs/claude-skill-audit.md`);
each copy has a `SOURCE.md` with its provenance. "Final status" uses the brief's vocabulary.

| Canonical name | Installed name | Source (path) | Global | Project | Purpose / stage | Conflicts, duplicates | Final status |
|---|---|---|---|---|---|---|---|
| karpathy-guidelines | `andrej-karpathy-skills:karpathy-guidelines` (plugin) + `karpathy-guidelines` (project copy) | forrestchang/andrej-karpathy-skills (claude.ai synced plugin) | plugin | yes | Stage A engineering discipline | Same content as the plugin | **APPLIED** |
| design-taste-frontend | `design-taste-frontend` | Leonxlnx/taste-skill (`D:\uvtr-digital\.claude\skills`) | yes | yes | Stage B visual direction | v1 kept separately as `design-taste-frontend-v1` (global only) | **APPLIED** |
| high-end-visual-design | `high-end-visual-design` | Leonxlnx/taste-skill | yes | yes | Stage B refinement | Some rules conflict with the brief (glass, giant radii); the brief won | **APPLIED** (selectively) |
| frontend-design | `frontend-design` | claude-plugins-official | yes | yes | Alternative visual-direction guide | Overlaps design-taste; not needed twice | NOT NEEDED |
| web-design-guidelines | `web-design-guidelines` | vercel-labs/agent-skills (`D:\skills\.claude\skills`) | yes | yes | Stage K accessibility/UX audit | none | **APPLIED** |
| impeccable | `impeccable` (v4.3.1) | impeccable (`D:\uvtr-digital\.claude\skills`; its 16 MB .exe is gitignored) | yes | yes | Stage T final polish | A Cowork scratch copy was superseded | **APPLIED** |
| emil-design-eng | `emil-design-eng` | emilkowalski/skill | yes | yes | Stage I interaction feel | none | **APPLIED** |
| pick-ui-library | `pick-ui-library` | emilkowalski/skill | yes | yes | Stage D library choice | `disable-model-invocation`: only you can run `/pick-ui-library` | UNAVAILABLE (decided by the brief's Stage D rule) |
| prototype | `prototype` | emilkowalski/skill | yes | yes | Stage E layout options | The layout was validated directly with screenshots | NOT NEEDED |
| minimalist-ui | `minimalist-ui` | Leonxlnx/taste-skill | yes | yes | Stage V clutter diagnostic | Used as a lens only; its monochrome aesthetic was not applied | **APPLIED** (diagnostic) |
| find-animation-opportunities | `find-animation-opportunities` | emilkowalski/skill | yes | yes | Stage G | none | **APPLIED** |
| animation-vocabulary | `animation-vocabulary` | emilkowalski/skill | yes | yes | Stage G vocabulary | none | **APPLIED** |
| animate | `animate` | emilkowalski/skill | yes | yes | Stage G implementation | `animate-expo` (React Native) not used | **APPLIED** |
| improve-animations | `improve-animations` | emilkowalski/skill | yes | yes | Stage H audit | none | **APPLIED** |
| review-animations | `review-animations` | emilkowalski/skill | yes | yes | Stage W final motion review | `disable-model-invocation`: only you can run `/review-animations` | UNAVAILABLE |
| mobile-native | `mobile-native` | emilkowalski/skill | yes | yes | Mobile sheet/touch checks | Its rules were covered by the guidelines and E2E runs | AVAILABLE |
| modern-web-guidance | `modern-web-guidance` | Gemini plugin copy (newer than the npx cache copy) | yes | yes | Platform features (popover, dialog, `@starting-style`) | npx copy superseded | AVAILABLE |
| chrome-devtools | `chrome-devtools` | Gemini chrome-devtools-plugin | yes | yes | Stage M browser debugging | Needs the chrome-devtools MCP (added to `.mcp.json`, active since the restart) | AVAILABLE (Playwright used instead) |
| a11y-debugging | `a11y-debugging` | Gemini chrome-devtools-plugin | yes | yes | Only if accessibility issues appear | axe found one contrast issue, fixed without it | NOT NEEDED |
| debug-optimize-lcp | `debug-optimize-lcp` | Gemini chrome-devtools-plugin | yes | yes | Stage N, only after measuring | LCP 1.77 s on Slow 4G + 4x CPU, within target | NOT NEEDED |
| playwright-cli | `playwright-cli` | npx playwright-core cache | yes | yes | Browser automation | `@playwright/test` used directly | AVAILABLE |
| code-review | built-in `code-review` | Claude Code | built-in | n/a | Stage R | none | **APPLIED** |
| security-review | built-in `security-review` | Claude Code | built-in | n/a | Stage Q | Needs a git remote (`origin/HEAD`), and commits need your OK | UNAVAILABLE (manual review done instead) |
| simplify | built-in `simplify` | Claude Code | built-in | n/a | Stage S | 3 of its 4 reviewers hit the usage limit; those angles were done inline | **APPLIED** |
| claude-security | `claude-security:claude-security` (plugin v0.12.0) | claude-plugins-official | plugin | n/a | Stages P/Q deep scan | Heavy multi-agent run | AVAILABLE (optional) |
| data:validate-data / explore-data | plugin `data:*` | claude.ai synced data plugin | plugin | n/a | Data QA | They QA analyses; geodata is validated by `scripts/validate-map-data.mjs` | NOT NEEDED |
| ask-sonner | `ask-sonner` | emilkowalski/skill | yes | no | Stage J toasts | Status is shown in place, no toasts | NOT NEEDED |
| image-to-code | `image-to-code` | Leonxlnx/taste-skill | yes | no | Stage C | No mockups supplied | NOT NEEDED |
| redesign-existing-projects | `redesign-existing-projects` | Leonxlnx/taste-skill | yes | no | Stage U | Greenfield build | NOT NEEDED |

## MCP / plugin status (Phase 0B, from `claude mcp list` / `claude plugin list`)

| Server | Status |
|---|---|
| claude.ai Claude Docs, claude.ai Figma | Connected at the start (later disconnected); not needed |
| playwright, chrome-devtools (project `.mcp.json`, pinned 0.0.82 / 1.10.1) | Configured here; available after the session restart |
| MongoDB Atlas, slack, notion, linear, atlassian, monday, clickup, hex, amplitude(-eu) | Need authentication (via `/mcp` or claude.ai connector settings); not needed for this project |
| asana, bigquery | Failed: "Incompatible auth server: does not support dynamic client registration" |
| definite | Failed: "MCP endpoint not found" |
| google calendar, gmail, snowflake, databricks | Not configured |
| Plugins | productivity, data, andrej-karpathy-skills (synced); claude-security (installed in this session) |
