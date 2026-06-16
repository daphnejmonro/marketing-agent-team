# Marketing Agent Standards & Change Flow

This document defines how to maintain, version, and change the marketing agent scripts. It is modelled on deployment standards adapted for a local script-based system rather than a CI/CD pipeline.

---

## Overview

The agent system consists of Node.js scripts and their supporting config files. Unlike a web application, there is no build pipeline or staging environment — changes go directly into use. This makes a clear change process more important, not less.

| File | Purpose |
|------|---------|
| `daily-briefing.js` | Morning KPI + intelligence briefing |
| `hosting-marketing-ops-hub.js` | Weekly planning pipeline (6 agents) |
| `hosting-seo-agent-system.js` | SEO audit + 90-day roadmap |
| `competitor-intel-agent.js` | Competitor intelligence |
| `content-pipeline.js` | 4-agent content creation pipeline |
| `spell-check-agent.js` | Full-site spell check via sitemap |
| `sync-sheet.js` | Pulls Search Console data → data.json |
| `create-doc.js` | Regenerates the Word setup guide |

---

## Coding Standards

### General
- Use ES6+ syntax throughout: `const`/`let`, arrow functions, template literals, destructuring
- Never use `var`
- Use `camelCase` for variables and functions
- Keep functions small and focused on a single task
- Follow the DRY principle — shared utilities (colors, data loading, Claude client init) must not be duplicated across scripts

### File Headers
Every script must begin with a header block:
```javascript
// Script name — one-line description
// v1.0.0 — YYYY-MM-DD
// Usage: node script-name.js [--flags]
```

### Data & Config
- `data.json` is the single source of truth for all KPI and team data. Never hardcode values that belong there.
- `sheet-config.json` maps Google Sheet tabs to `data.json` fields. Edit this, not the scripts, when Sheet IDs change.
- `credentials.json` handles Google API auth. Do not commit this file. Do not log its contents.

### Error Handling
- Validate that required files exist before parsing them
- Exit with `process.exit(1)` on any critical failure
- Print a clear, coloured error message explaining what is missing and how to fix it (follow the existing pattern in `daily-briefing.js`)

---

## Versioning

Each script carries its own version number in its file header. Use semantic versioning:

| Change type | Version bump | Example |
|-------------|-------------|---------|
| Bug fix or prompt tweak | Patch — `x.x.1` | `v1.0.1` |
| New CLI flag, new output section, new agent | Minor — `x.1.0` | `v1.1.0` |
| Breaking change to `data.json` schema or script interface | Major — `1.0.0` | `v2.0.0` |

A breaking change is anything that would cause another script or an existing command to fail without a corresponding update.

### CHANGELOG.md
Maintain a `CHANGELOG.md` at the root of the project. One line per change:

```
YYYY-MM-DD  spell-check-agent.js  v1.2.0  Added --max flag for URL limit
YYYY-MM-DD  data.json             —       Updated CAC and ROAS values
YYYY-MM-DD  daily-briefing.js     v1.1.1  Fixed colour rendering on macOS Terminal
```

`data.json` updates do not require a version bump — just log them in CHANGELOG.md.

---

## Change Workflow

Before making any change to a script, follow these steps:

### 1. Make the change
Edit the relevant `.js` file. Update the version number and last-modified date in the header.

### 2. Test with a limited run
Do not run a full production command first. Use a scoped test:

| Script | Test command |
|--------|-------------|
| `daily-briefing.js` | `node daily-briefing.js` (full run is fast, ~2 min) |
| `hosting-marketing-ops-hub.js` | `node hosting-marketing-ops-hub.js` (review first agent's output before letting it finish) |
| `spell-check-agent.js` | `node spell-check-agent.js --url=https://your-site.com --max=50` |
| `sync-sheet.js` | Run and verify `data.json` diff looks correct before relying on new data |
| Any script | Check terminal output for errors before treating the run as valid |

### 3. Verify the output
Read the output. Ask: does this look correct? Does it reflect real data? Are the KPIs plausible? If output looks wrong, fix before sharing or relying on it.

### 4. Update documentation
- Bump version in the file header
- Add one line to `CHANGELOG.md`
- If you added or changed a CLI flag: update `README.md`
- If you changed setup or dependencies: update `README.md`

---

## Monitoring (Lightweight)

There is no formal monitoring period. Apply good judgement:

- **After any script change**: check the first real output before sharing or acting on it
- **After a `data.json` update**: run `daily-briefing.js` to confirm KPIs render correctly
- **For the scheduled daily briefing**: if you changed anything that briefing touches, verify the next morning's output
- **If a script fails**: check in this order:
  1. Is Node 18 on PATH? (`node --version`)
  2. Is `ANTHROPIC_API_KEY` set?
  3. Does `credentials.json` exist? (required for sheet sync and spell check export)
  4. Is `data.json` valid JSON?

---

## Emergency Changes

If a script produces incorrect output that is already in use (e.g. wrong KPIs in a board report):

1. Fix the root cause — `data.json`, the prompt, or the script logic
2. Re-run the affected script to produce corrected output
3. Flag to whoever received the original output that an updated version is available
4. Log the incident in CHANGELOG.md with a note

---

## Quarterly Review

Once per quarter, review the following:

- Are all `data.json` values still accurate?
- Are the agent prompts still aligned with current business goals?
- Are there scripts that haven't been used? Consider archiving or removing them.
- Are there recurring manual steps that could be scripted?
