# Marketing Agent Team

A fleet of 8 Claude-powered agents that handle the marketing operations work your team shouldn't be doing manually — briefings, competitor analysis, SEO audits, content pipelines, spell checking, and weekly planning.

Built with Node.js and the [Anthropic SDK](https://github.com/anthropic-ai/sdk-js). Optionally integrates with Ahrefs and Google Search Console.

---

## The Agents

| Agent | What it does | Run time |
|-------|-------------|----------|
| `daily-briefing.js` | Morning KPI snapshot + Search Console briefing | ~2 min |
| `hosting-marketing-ops-hub.js` | 6-agent weekly planning pipeline (SEO, content, CRO, capacity, board) | ~15 min |
| `hosting-seo-agent-system.js` | Competitor keyword analysis + technical audit + 90-day SEO roadmap | ~10 min |
| `competitor-intel-agent.js` | Scrapes competitor homepages and pricing, outputs structured analysis | ~3 min |
| `content-pipeline.js` | 4-agent content pipeline: keyword opportunity → brief → E-E-A-T → full article | ~10 min |
| `spell-check-agent.js` | Full-site crawl via sitemap, finds spelling errors, exports to Google Sheets | ~45 min (full site) |
| `sync-sheet.js` | Pulls live Search Console data from Google Sheets → `data.json` | ~1 min |
| `create-doc.js` | Auto-generates a Word setup guide for your team | ~1 min |

---

## How They Connect

All agents read from `data.json` as a single source of truth for your KPIs, team, and goals. This means:
- No hardcoded numbers that go stale
- One update to `data.json` is reflected in every agent's output
- `sync-sheet.js` can keep `data.json` fresh automatically from your Google Sheet

The flow:
```
sync-sheet.js → data.json → all agents
competitor-intel-agent.js → competitor-intel.json → hosting-seo-agent-system.js + hosting-marketing-ops-hub.js
```

---

## Prerequisites

- **Node 18** — `node --version` should show `v18.x.x`
  ```bash
  # macOS (Homebrew)
  brew install node@18
  export PATH="/usr/local/Cellar/node@18/18.20.8/bin:$PATH"
  ```
- **Anthropic API key** — [console.anthropic.com](https://console.anthropic.com)
- **Ahrefs API key** *(optional)* — needed for `hosting-seo-agent-system.js` and `content-pipeline.js`
- **Google credentials** *(optional)* — needed for `sync-sheet.js` and `spell-check-agent.js --sheet`

---

## Setup

### 1. Install dependencies
```bash
cd marketing-agent-team
npm install
```

### 2. Set your API keys
```bash
cp .env.example .env
```
Then open `.env` in any text editor and paste your key after `ANTHROPIC_API_KEY=`
(get one from [console.anthropic.com](https://console.anthropic.com)). Add `AHREFS_API_KEY`
too if you have one — it's optional.

That's it — the agents read `.env` automatically every time they run, so there's
nothing to `export` and nothing to remember between sessions.

### 3. Add your business data
```bash
cp data.json.example data.json
# Edit data.json with your real KPIs, team, and goals
```

### 4. (Optional) Connect Google Sheets
```bash
cp sheet-config.json.example sheet-config.json
# Edit sheet-config.json with your Google Sheet ID
# Then follow the Google Cloud setup below to create credentials.json
```

**Google Cloud setup (for Sheets sync and spell check export):**
1. Go to [console.cloud.google.com](https://console.cloud.google.com) → Create project
2. Enable the **Google Sheets API**
3. IAM & Admin → Service Accounts → Create → Add Key (JSON) → save as `credentials.json` in this folder
4. Share your Google Sheet with the service account email (Viewer permission)

---

## Run it

Open Claude Code in this folder, then run any agent as a slash command:

```bash
claude
```

Then type `/daily-briefing` — or any command from the table below. Each one runs its
agent and shows you the output. Type `/` in Claude Code to see them all.

If your Anthropic key isn't set up yet, the agent prints step-by-step instructions
instead of an error.

### The agents, as slash commands

Every agent is a Claude Code skill — one slash command each:

| Command | Runs | Notes |
|---------|------|-------|
| `/daily-briefing` | `daily-briefing.js` | Morning KPI + Search Console brief |
| `/seo-audit` | `hosting-seo-agent-system.js` | Competitor analysis + 90-day roadmap (~10 min) |
| `/weekly-planning` | `hosting-marketing-ops-hub.js` | 6-agent planning pipeline (~15 min) |
| `/spell-check` | `spell-check-agent.js` | Pass a URL; defaults to hosting.com |
| `/content-brief` | `content-pipeline.js` | Give it a topic, e.g. `/content-brief vps hosting` |
| `/competitor-intel` | `competitor-intel-agent.js` | Scrapes competitor homepages + pricing |
| `/sync-sheet` | `sync-sheet.js` | Needs Google credentials (see setup) |
| `/create-doc` | `create-doc.js` | Generates the team Word doc |

Type `/` in Claude Code to see them all. Skills live in `.claude/skills/` — a Markdown file each.

---

## Weekly Rhythm

```
Daily:     /sync-sheet  then  /daily-briefing
Monday:    /sync-sheet  then  /weekly-planning
Quarterly: /competitor-intel  then  /seo-audit
Ad hoc:    /content-brief <topic>
           /spell-check <url>
```

---

## Architecture

Each agent follows the same pattern:
1. Load `data.json` (single source of truth)
2. Fetch live data from APIs (Ahrefs, Search Console) in parallel
3. Build a prompt dynamically from real data
4. Call Claude (claude-sonnet-4-6 via `@anthropic-ai/sdk`)
5. Output structured results (JSON, markdown, or Google Sheet)

The `hosting-marketing-ops-hub.js` orchestrates 6 sub-agents sequentially, where each agent's output feeds the next.

---

## Adapting to Your Stack

The agents are built for a hosting company but the patterns work for any marketing team:

- **Change the domain** — update `data.json` and swap `hosting.com` references in the scripts
- **Change the KPIs** — edit `data.json` structure and the prompts that reference it
- **Add new data sources** — follow the `Promise.all` pattern in `hosting-seo-agent-system.js`
- **Add new agents** — copy any existing script as a template; load `data.json`, build prompt, call Claude

---

## Stack

- **Runtime:** Node.js 18
- **AI:** Claude Sonnet via `@anthropic-ai/sdk`
- **SEO data:** Ahrefs API v3
- **Search data:** Google Search Console (via Google Sheets)
- **Exports:** Google Sheets API, `.docx` (via `docx` package)
- **Crawling:** `axios` + `cheerio`

---

## Troubleshooting

| Problem | Fix |
|---------|-----|
| `data.json not found` | `cp data.json.example data.json` and fill in your values |
| `Setup needed: your Anthropic API key isn't set` | `cp .env.example .env`, then paste your key after `ANTHROPIC_API_KEY=` |
| Ahrefs calls skipped | Set `AHREFS_API_KEY` — agents degrade gracefully without it |
| `credentials.json not found` | Follow Google Cloud setup above |
| Node version error | Make sure Node 18 is on your PATH |

---

*Presented live at the Building Your First Agentic Marketing Team webinar.*
