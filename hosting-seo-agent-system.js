#!/usr/bin/env node

/**
 * Multi-Agent SEO Operations System for hosting.com
 * 
 * Architecture:
 * 1. Technical SEO Agent → audits site infrastructure, crawl health, performance
 * 2. Content SEO Agent → identifies keyword gaps, emerging topics, competitor content
 * 3. Manager Agent → synthesizes both inputs, prioritizes by impact, aligns with 2026 SEO trends
 * 
 * Run with: node hosting-seo-agent-system.js [--target-url] [--competitors]
 */

const Anthropic = require("@anthropic-ai/sdk");
const axios = require("axios");
const fs = require("fs");
const path = require("path");

const AHREFS_API_KEY = process.env.AHREFS_API_KEY;
const AHREFS_BASE = "https://api.ahrefs.com/v3";

async function callAhrefs(endpoint, params) {
  if (!AHREFS_API_KEY) return null;
  try {
    const response = await axios.get(`${AHREFS_BASE}${endpoint}`, {
      headers: { Authorization: `Bearer ${AHREFS_API_KEY}` },
      params,
      timeout: 15000,
    });
    return response.data;
  } catch (err) {
    log.warning(`Ahrefs API error (${endpoint}): ${err.response?.data?.detail || err.message}`);
    return null;
  }
}

async function fetchAhrefsContentData(targetDomain) {
  if (!AHREFS_API_KEY) {
    log.warning("AHREFS_API_KEY not set — skipping live data, Claude will use general knowledge");
    return null;
  }

  const today = new Date().toISOString().split("T")[0];
  log.item("Fetching live Ahrefs data...");

  const [keywordsData, metricsData, competitorsData] = await Promise.all([
    callAhrefs("/site-explorer/organic-keywords", {
      target: targetDomain,
      date: today,
      select: "keyword,best_position,volume,keyword_difficulty,sum_traffic",
      limit: 25,
      mode: "domain",
      order_by: "sum_traffic:desc",
    }),
    callAhrefs("/site-explorer/metrics", {
      target: targetDomain,
      date: today,
      select: "org_keywords,org_traffic",
      mode: "domain",
    }),
    callAhrefs("/site-explorer/organic-competitors", {
      target: targetDomain,
      date: today,
      select: "competitor,common_keywords,competitor_keywords",
      limit: 10,
      mode: "domain",
    }),
  ]);

  const lines = [];

  if (metricsData?.metrics) {
    const m = metricsData.metrics;
    lines.push(`ORGANIC OVERVIEW (live from Ahrefs):`);
    lines.push(`  Total organic keywords: ${m.org_keywords?.toLocaleString() || "N/A"}`);
    lines.push(`  Estimated monthly organic traffic: ${m.org_traffic?.toLocaleString() || "N/A"}`);
  }

  if (keywordsData?.keywords?.length) {
    lines.push(`\nTOP 25 ORGANIC KEYWORDS (by traffic):`);
    keywordsData.keywords.forEach((k, i) => {
      lines.push(`  ${i + 1}. "${k.keyword}" — pos ${k.best_position}, vol ${k.volume?.toLocaleString()}, traffic ${k.sum_traffic?.toLocaleString()}, KD ${k.keyword_difficulty}`);
    });
  }

  if (competitorsData?.competitors?.length) {
    lines.push(`\nTOP ORGANIC COMPETITORS:`);
    competitorsData.competitors.slice(0, 5).forEach((c) => {
      lines.push(`  ${c.competitor} — ${c.common_keywords?.toLocaleString()} common keywords, ${c.competitor_keywords?.toLocaleString()} total keywords`);
    });
  }

  if (!lines.length) return null;
  log.success("Ahrefs data fetched");
  return lines.join("\n");
}

const client = new Anthropic.default();

function loadCompetitorIntel() {
  const intelPath = path.join(__dirname, "competitor-intel.json");
  if (!fs.existsSync(intelPath)) return null;
  try {
    const intel = JSON.parse(fs.readFileSync(intelPath, "utf8"));
    const ageDays = Math.floor((Date.now() - new Date(intel.timestamp).getTime()) / (1000 * 60 * 60 * 24));
    log.success(`Competitor intel loaded (${ageDays} day${ageDays !== 1 ? "s" : ""} old)`);
    if (ageDays > 7) log.warning("Intel is over 7 days old — consider re-running competitor-intel-agent.js");
    return intel.analysis;
  } catch {
    return null;
  }
}

// Color output for CLI readability
const colors = {
  reset: "\x1b[0m",
  bright: "\x1b[1m",
  dim: "\x1b[2m",
  cyan: "\x1b[36m",
  green: "\x1b[32m",
  yellow: "\x1b[33m",
  red: "\x1b[31m",
};

const log = {
  section: (title) =>
    console.log(`\n${colors.bright}${colors.cyan}═══ ${title} ═══${colors.reset}`),
  agent: (name) =>
    console.log(`\n${colors.bright}${colors.green}→ ${name}${colors.reset}`),
  subsection: (title) =>
    console.log(`\n${colors.bright}${title}${colors.reset}`),
  item: (text) => console.log(`  ${text}`),
  success: (text) => console.log(`  ${colors.green}✓${colors.reset} ${text}`),
  warning: (text) => console.log(`  ${colors.yellow}⚠${colors.reset} ${text}`),
  error: (text) => console.log(`  ${colors.red}✗${colors.reset} ${text}`),
};

/**
 * AGENT 1: Technical SEO Auditor
 * Analyzes: crawlability, site architecture, performance, structured data, UX signals
 */
async function technicalSEOAgent(targetUrl = "https://hosting.com") {
  log.agent("Technical SEO Agent");
  log.item(`Auditing: ${targetUrl}`);

  const systemPrompt = `You are a world-class technical SEO auditor specializing in 2026 web standards. 
You review websites holistically across:
- Crawl architecture & site structure (sitemaps, robots.txt, internal linking patterns)
- Core Web Vitals (LCP, FID, CLS) and page speed metrics
- Mobile-first indexing readiness & responsive design
- Structured data (schema.org markup, JSON-LD)
- HTTP status codes, redirect chains, canonicals
- Crawl errors, blocked resources, JavaScript rendering issues
- Security signals (HTTPS, CSP headers, bot traffic quality)
- AMP/Core Web Vitals compliance

Return findings as a prioritized list: P0 (blocks indexing/ranking), P1 (harms UX/ranking), P2 (nice-to-have optimizations).
Format: [PRIORITY] Issue | Impact | Recommended fix.`;

  const userPrompt = `Conduct a technical SEO audit for ${targetUrl}.
Focus on:
1. Crawl efficiency & site architecture
2. Performance metrics (Core Web Vitals)
3. Mobile usability & responsive design
4. Structured data implementation
5. Security & trust signals
6. JavaScript rendering & dynamic content handling
7. Duplicate content & canonicalization
8. Redirect health

Provide 8-12 findings, prioritized by impact on ranking and user experience.
Be specific: reference actual issues (e.g., "LCP 3.8s vs target 2.5s", not "page is slow").`;

  const response = await client.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 2000,
    system: systemPrompt,
    messages: [{ role: "user", content: userPrompt }],
  });

  const technicalFindings =
    response.content[0].type === "text" ? response.content[0].text : "";
  log.subsection("Technical SEO Findings:");
  log.item(technicalFindings);

  return technicalFindings;
}

/**
 * AGENT 2: Content SEO Specialist
 * Analyzes: keyword gaps, competitor content, emerging topics, search intent
 */
async function contentSEOAgent(
  targetUrl = "https://hosting.com",
  competitors = ["bluehost.com", "namecheap.com", "godaddy.com"]
) {
  log.agent("Content SEO Specialist");
  log.item(`Researching market for: ${targetUrl}`);
  log.item(`Competitors: ${competitors.join(", ")}`);

  const targetDomain = new URL(targetUrl).hostname.replace("www.", "");
  const ahrefsData = await fetchAhrefsContentData(targetDomain);

  const systemPrompt = `You are a strategic content SEO specialist focused on 2026 search behavior patterns.
You analyze:
- Search intent shifts (informational, navigational, commercial, transactional)
- Keyword opportunity clusters (high-volume, low-competition, emerging)
- Competitor content gaps & your unique positioning angles
- Topic clusters & thematic relevance (E-E-A-T signals)
- Voice search & conversational query trends
- AI Overviews & generative search implications
- User behavior signals (click-through patterns, dwell time, bounce indicators)
- Emerging topics & trend acceleration in your vertical

Return findings as: Gap | Search Volume | Opportunity | Angle | Priority.
Focus on clusters of 3-5 semantically related keywords that form pillar-cluster content strategies.`;

  const liveDataSection = ahrefsData
    ? `\nLIVE AHREFS DATA (use this as your primary source — do not estimate what's already provided here):\n${ahrefsData}\n`
    : "\nNote: No live Ahrefs data available — use your general knowledge of the hosting market.\n";

  const userPrompt = `Conduct market research for ${targetUrl} (a web hosting provider).
Analyze against top competitors: ${competitors.join(", ")}.
${liveDataSection}
Identify:
1. High-value keyword gaps (50-500 monthly searches, low KD%)
2. Emerging topics in hosting/infrastructure (AI, sustainability, security)
3. Content format opportunities (buyers' guides, vs. comparisons, tutorials)
4. Semantic clusters (group related keywords into pillar-cluster topics)
5. Search intent mismatches (where competitors answer, we're weak)
6. Conversational query opportunities (voice, featured snippets)
7. Long-tail informational queries with monetization potential
8. Affiliate/partner content angles

Suggest 5-7 new content clusters with 3-5 keywords each. Include:
- Estimated monthly search volume
- Keyword difficulty score (1-100)
- Commercial intent (% of queries leading to purchases)
- Your competitive advantage angle`;

  const response = await client.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 2000,
    system: systemPrompt,
    messages: [{ role: "user", content: userPrompt }],
  });

  const contentFindings =
    response.content[0].type === "text" ? response.content[0].text : "";
  log.subsection("Content SEO Findings:");
  log.item(contentFindings);

  return contentFindings;
}

/**
 * AGENT 3: SEO Manager (Decision-Maker)
 * Synthesizes technical + content findings, prioritizes by impact, aligns with 2026 trends
 */
async function seoManagerAgent(technicalFindings, contentFindings, competitorIntel) {
  log.agent("SEO Manager (Synthesis & Prioritization)");

  const systemPrompt = `You are the Chief SEO Strategist for hosting.com, reporting to the Head of Marketing.
You synthesize technical and content audits into a unified, prioritized action plan.

Your decision framework (2026 SEO):
1. User experience first: Core Web Vitals, accessibility, mobile usability drive ranking
2. Search intent alignment: Match content to query intent; AI Overviews reward comprehensive, authoritative answers
3. E-E-A-T signals: Technical implementation + topical authority + author credibility
4. Content efficiency: Pillar-cluster architecture > siloed content; semantic richness matters
5. Traffic velocity: Quick wins (existing pages that need small fixes) compound faster than new content
6. Revenue impact: Prioritize keywords/fixes that directly influence CAC, LTV, ROAS
7. Operational capacity: Assume a team of 6 content creators + 1 SEO specialist; set quarterly roadmap

Decision rules:
- P0 technical issues that block ranking: fix before publishing new content
- Content gaps with high search volume + low competition + high intent match: immediate content calendar
- Competitive advantages: leverage Daphne's GEO/AEO expertise and agentic AI workflows
- Risk management: flag outdated content, duplicate content, UX issues that increase bounce rate

Return output:
1. Executive summary (1 paragraph)
2. P0 priorities (fix within 2 weeks)
3. P1 priorities (fix within 6 weeks)
4. Content roadmap (8-12 pieces, next 90 days)
5. Resource allocation (time/team estimates)
6. Success metrics & KPIs to track
7. Risk mitigation steps`;

  const competitorSection = competitorIntel
    ? `\nCOMPETITOR INTELLIGENCE (use to identify content gaps and messaging opportunities):\n${competitorIntel}`
    : "\nCOMPETITOR INTELLIGENCE:\nNot available — run competitor-intel-agent.js to generate.";

  const userPrompt = `You are the SEO manager for hosting.com. Synthesize the following audit findings:

TECHNICAL SEO FINDINGS:
${technicalFindings}

CONTENT SEO FINDINGS:
${contentFindings}
${competitorSection}

Now:
1. Identify the 3-5 most critical issues across both audits
2. Recommend a 90-day action plan with specific initiatives
3. Allocate your 6-person content team + 1 SEO specialist efficiently
4. Project impact: which actions will move your top 3 KPIs (MRR, organic conversion %, ROAS)?
5. Flag any technical debt that limits content scalability
6. Suggest quick wins (existing pages that need small optimizations)
7. Align content strategy with Daphne's GEO/LLM-optimized content expertise
8. Identify which content will feed your affiliate programme (highest partner relevance)

Format as a prioritized action plan with:
- Initiative name
- Owner (Content team, SEO specialist, or Dev)
- Timeline (weeks)
- Expected impact on MRR/CAC/LTV/ROAS
- Success metrics
- Dependencies`;

  const response = await client.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 6000,
    system: systemPrompt,
    messages: [{ role: "user", content: userPrompt }],
  });

  const managedPlan =
    response.content[0].type === "text" ? response.content[0].text : "";
  log.subsection("Synthesized SEO Action Plan:");
  log.item(managedPlan);

  return managedPlan;
}

/**
 * Orchestration: Run all agents in sequence
 */
async function runSEOOperationsPipeline(targetUrl, competitors) {
  log.section("hosting.com SEO Operations Pipeline");
  console.log(
    `${colors.dim}Orchestrating multi-agent SEO audit and strategy session${colors.reset}`
  );

  try {
    const competitorIntel = loadCompetitorIntel();

    // Step 1: Technical audit
    console.log();
    const technicalFindings = await technicalSEOAgent(targetUrl);

    // Step 2: Content research
    console.log();
    const contentFindings = await contentSEOAgent(targetUrl, competitors);

    // Step 3: Manager synthesis
    console.log();
    const actionPlan = await seoManagerAgent(technicalFindings, contentFindings, competitorIntel);

    // Final output
    log.section("Pipeline Complete");
    log.success("All agents completed. Full report ready for review.");

    // Save to file for future reference
    const report = {
      timestamp: new Date().toISOString(),
      targetUrl,
      competitors,
      technicalFindings,
      contentFindings,
      actionPlan,
    };

    const fs = require("fs");
    const reportPath = `hosting-seo-report-${Date.now()}.json`;
    fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
    log.success(`Full report saved to: ${reportPath}`);

    return report;
  } catch (error) {
    log.error(`Pipeline failed: ${error.message}`);
    throw error;
  }
}

/**
 * CLI Entry Point
 */
async function main() {
  const args = process.argv.slice(2);
  const targetUrl =
    args.find((arg) => arg.startsWith("--target-url="))?.split("=")[1] ||
    "https://hosting.com";
  const competitorArg = args.find((arg) =>
    arg.startsWith("--competitors=")
  );
  const competitors = competitorArg
    ? competitorArg.split("=")[1].split(",")
    : ["bluehost.com", "namecheap.com", "godaddy.com"];

  await runSEOOperationsPipeline(targetUrl, competitors);
}

main().catch((err) => {
  console.error(
    `${colors.red}Fatal error:${colors.reset}`,
    err.message
  );
  process.exit(1);
});
