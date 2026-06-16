# Webinar: Building Your First Agentic Marketing Team with Claude Code

**Duration:** 1 hour  
**Format:** Live demo — you'll run agents on your own machine alongside the presenter  
**Outcome:** Understand how to build and orchestrate marketing agents

---

## Pre-Webinar Setup (Do This Before We Start)

**Time needed:** 5 minutes

### 1. Clone the repo
```bash
git clone https://github.com/daphnejmonro/marketing-agent-team.git
cd marketing-agent-team
```

### 2. Install dependencies
```bash
npm install
```

### 3. Set your API key
```bash
cp .env.example .env
```
Then open `.env` in any text editor and paste your key after `ANTHROPIC_API_KEY=`
(get one from [console.anthropic.com](https://console.anthropic.com)). The agents read
`.env` automatically every run — so it keeps working even if you open a new terminal tab.

### 4. Copy demo data
```bash
cp WEBINAR_DEMO_DATA.json data.json
```

**That's it!** You're ready. You do NOT need Google Sheets or Ahrefs keys for the live demos.

---

## During the Webinar: What You'll Run

The presenter will walk through 3 agents. Run each command at the same time they do.

### Agent #1: Daily Briefing (2 minutes)

**What it does:** Loads your KPIs from `data.json`, calls Claude, outputs a morning intelligence brief.

**Your command (type it inside Claude Code):**
```
/daily-briefing
```

**Expected output:**
```
═══ HOSTING.COM DAILY INTELLIGENCE ═══

KPI SNAPSHOT
✓ MRR: €180,000 (on track vs 15% YoY target)
✓ CAC: €48 (5.5% over €45 budget — watch this)
⚠ Organic Conv%: 3.8% (plateau since March — needs CRO push)

TODAY'S SINGLE FOCUS
→ Accelerate organic conversion: Run 2 CRO tests this week

TOP BLOCKER
• Organic conversion stuck at 3.8% for 8 weeks

DECISION NEEDED
Q: Should we pause new content and double down on CRO experiments?
→ Recommend: YES. One well-designed experiment beats 3 generic articles.

RISK ALERT
🔴 CAC creep: €48 vs €45 budget. Need organic growth to offset paid.
```

**Key insight:** One command, real data, structured output. This is the pattern every agent follows.

---

### Agent #2: Content Pipeline (10-15 minutes)

**What it does:** 4 agents running in sequence:
1. **Opportunity Agent** — finds the best keyword angle for your topic
2. **Brief Agent** — writes a detailed content brief with secondary keywords
3. **E-E-A-T Agent** — adds authority/expertise layer
4. **Writer Agent** — writes the full article in markdown

**Your command (type it inside Claude Code):**
```
/content-brief vps hosting
```

**Expected output:** A full markdown article (~1000-1500 words) on "VPS Hosting" with:
- H1 title
- SEO-optimized intro
- Body sections (Benefits, How to Choose, Comparison, Best Practices, etc.)
- E-E-A-T callouts (citations, expert quotes, methodology notes)
- CTA at the end

**Real example section:**
```markdown
## What is VPS Hosting?

A Virtual Private Server (VPS) gives you a dedicated slice of a physical server 
with guaranteed resources. Unlike shared hosting, you control your environment. 
Unlike dedicated servers, you pay less.

**Why this matters for your site:** If you've outgrown shared hosting but aren't 
ready to manage a full server, VPS is the sweet spot.

[Rest of article...]
```

**Key insight:** Watch how one agent's output becomes the next agent's INPUT. That's agent chaining.

---

### Agent #3: Spell Check (3-5 minutes)

**What it does:** Crawls a website, extracts visible text from each page, uses Claude to find spelling/grammar errors, outputs a CSV report.

**Your command (type it inside Claude Code):**
```
/spell-check
```

(Defaults to hosting.com and a quick 20-page sample. Pass a URL — `/spell-check https://your-site.com` — to check another site; a full-site crawl takes ~45 min.)

**Expected output:**
```
✓ Crawled 20 pages from hosting.com

Scanning for spelling, grammar, and formatting errors...

✓ Found 8 errors across 4 pages

RESULTS:
  /hosting/vps-hosting/     3 errors (highest severity)
  /                         2 errors
  /ai-application-hosting   2 errors
  /managed-hosting/         1 error

📄 Report: spell-check-report-[timestamp].json
```

**Key insight:** This is a REAL QA tool you can use on any site. Takes 45 minutes for a full crawl but catches errors no human QA would find.

---

## After the Webinar: Code Walkthroughs

The presenter will walk through the code and architecture of 2 more agents (you watch, don't run):

### Agent #4: Marketing Ops Hub (Pre-recorded demo)

**What it does:** Orchestrates 6 domain-specific agents:
1. SEO Operations Agent
2. Content Pipeline Agent
3. CRO Strategy Agent
4. Affiliate Manager Agent
5. Operations Planner Agent
6. Board Reporting Agent

Then a **Manager Agent** synthesizes all outputs into one unified priority list.

**Why it's powerful:** This replaces your weekly planning meeting. One command gives you a full operations plan with sequencing, resource conflicts resolved, and strategic priorities ranked.

**Time:** ~15 minutes to run (presenter pre-ran this)

**Key insight:** This is how you scale from individual agents to an orchestrated system.

---

### Agent #5: SEO System (Code walkthrough)

**What it does:** Multi-agent SEO audit:
1. **Technical SEO Agent** → Crawls site, checks performance, indexation, core web vitals
2. **Content SEO Agent** → Analyzes keyword gaps, competitor coverage, emerging topics
3. **Manager Agent** → Synthesizes both inputs, prioritizes by impact

**Key insight:** Watch the `Promise.all()` pattern for parallel API calls. This is how you fetch multiple data sources without waiting sequentially.

---

## If Something Goes Wrong

### Error: `data.json not found`
```bash
cp WEBINAR_DEMO_DATA.json data.json
```

### Error: `Setup needed: your Anthropic API key isn't set`
```bash
cp .env.example .env   # then open .env and paste your key after ANTHROPIC_API_KEY=
```

### Node version error
```bash
node --version  # Should be v18.x or higher
```

If you have multiple Node versions, use:
```bash
export PATH="/usr/local/Cellar/node@18/18.20.8/bin:$PATH"  # macOS example
```

### Agent is slow / timing out
- `daily-briefing.js` should take 2 min max
- `content-pipeline.js` should take 10-15 min
- `spell-check-agent.js --max=20` should take 3-5 min

If it's taking longer, check your network. Claude API calls can occasionally be slow.

---

## After the Webinar: Next Steps

1. **Try customizing the data:** Replace `data.json` with your own real KPIs and see how the agents adapt
2. **Add your own API key:** If you have an Ahrefs key, add `AHREFS_API_KEY=` to your `.env` and run `hosting-seo-agent-system.js`
3. **Clone the repo for your own company:** Fork the repo and adapt the agents to your use case
4. **Share with your team:** Let them run the agents, build their own agents from this template

---

## Questions During the Webinar?

Ask in the chat or Q&A. Common topics:
- "How do I customize the prompts?" → Edit the agent scripts directly
- "Can I use this for my own company?" → Yes, fork the repo and customize `data.json`
- "What if I want to add a new agent?" → Copy any existing agent as a template, follow the same pattern
- "How much does this cost?" → Just your Anthropic API key (~$0.01-1.00 per agent run, depends on usage)

---

**Let's build something cool. See you in the webinar! 🚀**
