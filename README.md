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

**Bonus tool:** `json-ld-crawler.js` — crawls your site via sitemap, detects malformed JSON-LD/schema markup, exports results to Google Sheets.

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
# Edit .env and add your ANTHROPIC_API_KEY (and AHREFS_API_KEY if you have one)
export ANTHROPIC_API_KEY="sk-ant-..."
export AHREFS_API_KEY="your-key"   # optional
```

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

```bash
# Morning briefing
node daily-briefing.js

# SEO deep-dive
node daily-briefing.js --detailed --focus=seo

# Weekly planning pipeline
node hosting-marketing-ops-hub.js

# Competitor intelligence (run before SEO system for freshest data)
node competitor-intel-agent.js

# SEO audit + 90-day roadmap
node hosting-seo-agent-system.js

# Content pipeline (give it a topic)
node content-pipeline.js --topic="gdpr compliant hosting"
node content-pipeline.js --topic="vps hosting" --competitors="hostinger.com,siteground.com"

# Spell check (any site)
node spell-check-agent.js --url=https://your-site.com --max=50       # quick sample
node spell-check-agent.js --url=https://your-site.com --max=2000 --sheet  # full crawl

# Sync Search Console data
node sync-sheet.js

# Generate team setup guide
node create-doc.js

# JSON-LD / schema markup audit (bonus)
node json-ld-crawler.js
```

---

## Weekly Rhythm

```
Monday:    node sync-sheet.js && node hosting-marketing-ops-hub.js
Daily:     node sync-sheet.js && node daily-briefing.js
Quarterly: node competitor-intel-agent.js && node hosting-seo-agent-system.js
Ad hoc:    node content-pipeline.js --topic="your topic"
           node spell-check-agent.js --url=https://your-site.com
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
- **Crawling:** `axios` + `cheerio` + `puppeteer`

---

## Troubleshooting

| Problem | Fix |
|---------|-----|
| `data.json not found` | `cp data.json.example data.json` and fill in your values |
| `ANTHROPIC_API_KEY not set` | `export ANTHROPIC_API_KEY='sk-ant-...'` |
| Ahrefs calls skipped | Set `AHREFS_API_KEY` — agents degrade gracefully without it |
| `credentials.json not found` | Follow Google Cloud setup above |
| Node version error | Make sure Node 18 is on your PATH |

---

*Presented live at the Building Your First Agentic Marketing Team webinar.*
