# hosting.com Marketing Agent Team

A fleet of Node.js agents powered by the Anthropic SDK that handle repeatable marketing-ops work: morning briefings, SEO audits, competitor intel, content pipelines, spell checks, and weekly planning. Every agent reads shared context from this file and live data from `data.json`.

## Brand & voice
- Brand: **hosting.com**
- Voice: clear, direct, no hype. Write like a senior operator briefing a busy team.
- Search Console property: `sc-domain:hosting.com`

## Data & source of truth
- **`data.json` is the single source of truth** for all KPIs, team structure, goals, blockers, and competitors. Never hardcode these values in scripts — read them from `data.json`.
- `sync-sheet.js` refreshes `data.json` from Google Sheets. Run it before the other agents so nobody works off stale numbers.
- `sheet-config.json` maps Google Sheet tabs/cells → `data.json` fields. Change Sheet locations there, not in the scripts.
- Copy the templates to get started: `cp data.json.example data.json` and `cp sheet-config.json.example sheet-config.json`.

## Output conventions
- Prefer **structured JSON** output where another agent consumes the result (the manager/orchestrator pattern depends on this). Define the schema in the prompt.
- For human-facing briefings, lead with the most important item; keep it scannable.
- Pass real data into prompts. Never ask an agent to invent KPIs.

## Coding standards
Full reference: `AGENT_STANDARDS.md`. In short:
- ES6+ only — `const`/`let` (never `var`), arrow functions, template literals, destructuring; `camelCase` naming.
- Keep functions small and DRY. Shared utilities (colors, data loading, Claude client init) must not be duplicated across scripts.
- Each script starts with a header block: name, one-line description, version, usage.
- Validate that required files exist before parsing. On any critical failure, print a clear coloured error explaining what's missing and how to fix it, then `process.exit(1)` (see the pattern in `daily-briefing.js`).

## Secrets — never commit or log these
`.env`, `credentials.json`, `data.json`, and `sheet-config.json` are gitignored and contain keys or private data. Never commit them, never print their contents, never paste them into prompts.

## Agent roster
| Agent | What it does | Reads / writes |
|-------|-------------|----------------|
| `daily-briefing.js` | Morning KPI + Search Console snapshot | reads `data.json` |
| `hosting-marketing-ops-hub.js` | 6-agent weekly planning pipeline (SEO, content, CRO, capacity, board) | reads `data.json`, `competitor-intel.json` |
| `hosting-seo-agent-system.js` | Competitor keyword analysis + technical audit + 90-day roadmap | Ahrefs API, `competitor-intel.json` |
| `competitor-intel-agent.js` | Scrapes competitor homepages/pricing → structured analysis | writes `competitor-intel.json` |
| `content-pipeline.js` | 4-agent content pipeline: opportunity → brief → E-E-A-T → article | Ahrefs API |
| `spell-check-agent.js` | Full-site crawl for spelling/grammar; CSV + optional Google Sheet | prompts for URL; `--sheet-id=` for export |
| `sync-sheet.js` | Pulls live Search Console data from Google Sheets → `data.json` | `sheet-config.json` |
| `create-doc.js` | Auto-generates the Word setup/security guide | writes `.docx` |

**Bonus:** `json-ld-crawler.js` — detects malformed JSON-LD/schema markup site-wide; exports to a Sheet (requires `--sheet-id=`).
