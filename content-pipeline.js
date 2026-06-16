#!/usr/bin/env node
require("dotenv").config({ quiet: true });

/**
 * Content Creation Pipeline for hosting.com
 *
 * Four-agent sequential pipeline:
 * 1. Opportunity Agent  → identifies best keyword/angle for the topic
 * 2. Brief Agent        → builds a complete content brief with secondary keywords
 * 3. EEAT Agent         → adds E-E-A-T enhancement layer to the brief
 * 4. Writer Agent       → writes the full article in markdown
 *
 * Usage:
 *   node content-pipeline.js --topic="gdpr compliant hosting"
 *   node content-pipeline.js --topic="vps hosting" --competitors="hostinger.com,siteground.com"
 */

const Anthropic = require("@anthropic-ai/sdk");
const axios = require("axios");
const fs = require("fs");
const path = require("path");

const AHREFS_API_KEY = process.env.AHREFS_API_KEY;
const AHREFS_BASE = "https://api.ahrefs.com/v3";
const TARGET_DOMAIN = "hosting.com";
const OUTPUT_DIR = path.join(__dirname, "content");

require("./check-setup")();
const client = new Anthropic.default();

// ─── Colour helpers ───────────────────────────────────────────────────────────

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

// ─── Data loading ─────────────────────────────────────────────────────────────

function loadData() {
  const dataPath = path.join(__dirname, "data.json");
  // Fall back to the bundled demo data so a fresh download runs immediately.
  const filePath = fs.existsSync(dataPath)
    ? dataPath
    : path.join(__dirname, "WEBINAR_DEMO_DATA.json");
  if (!fs.existsSync(filePath)) {
    log.error("data.json not found — copy the template: cp data.json.example data.json");
    process.exit(1);
  }
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function loadCompetitorIntel() {
  const intelPath = path.join(__dirname, "competitor-intel.json");
  if (!fs.existsSync(intelPath)) return null;
  try {
    const intel = JSON.parse(fs.readFileSync(intelPath, "utf8"));
    const ageDays = Math.floor(
      (Date.now() - new Date(intel.timestamp).getTime()) / (1000 * 60 * 60 * 24)
    );
    log.success(`Competitor intel loaded (${ageDays} day${ageDays !== 1 ? "s" : ""} old)`);
    if (ageDays > 7)
      log.warning("Intel is over 7 days old — consider re-running competitor-intel-agent.js");
    return intel.analysis;
  } catch {
    return null;
  }
}

// ─── Ahrefs helpers ───────────────────────────────────────────────────────────

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

async function fetchOpportunityData(topic, competitors) {
  if (!AHREFS_API_KEY) {
    log.warning("AHREFS_API_KEY not set — agents will use general knowledge");
    return null;
  }

  const today = new Date().toISOString().split("T")[0];
  log.item("Fetching Ahrefs opportunity data...");

  const competitorFetches = competitors.map((domain) =>
    callAhrefs("/site-explorer/organic-keywords", {
      target: domain,
      date: today,
      select: "keyword,best_position,volume,keyword_difficulty,sum_traffic",
      limit: 50,
      mode: "domain",
      order_by: "sum_traffic:desc",
      search: topic,
    })
  );

  const [hostingMetrics, hostingExisting, ...competitorResults] = await Promise.all([
    callAhrefs("/site-explorer/metrics", {
      target: TARGET_DOMAIN,
      date: today,
      select: "org_keywords,org_traffic",
      mode: "domain",
    }),
    callAhrefs("/site-explorer/organic-keywords", {
      target: TARGET_DOMAIN,
      date: today,
      select: "keyword,best_position,volume,keyword_difficulty,url",
      limit: 30,
      mode: "domain",
      order_by: "best_position:asc",
      search: topic,
    }),
    ...competitorFetches,
  ]);

  const lines = [];

  if (hostingMetrics?.metrics) {
    const m = hostingMetrics.metrics;
    lines.push(`hosting.com ORGANIC OVERVIEW:`);
    lines.push(`  Total organic keywords: ${m.org_keywords?.toLocaleString() || "N/A"}`);
    lines.push(`  Monthly organic traffic: ${m.org_traffic?.toLocaleString() || "N/A"}`);
  }

  if (hostingExisting?.keywords?.length) {
    lines.push(`\nEXISTING hosting.com COVERAGE for "${topic}" (DO NOT TARGET THESE — cannibalism risk):`);
    hostingExisting.keywords.forEach((k) => {
      lines.push(
        `  "${k.keyword}" — pos ${k.best_position}, vol ${k.volume?.toLocaleString()}, KD ${k.keyword_difficulty}, page: ${k.url}`
      );
    });
    log.warning(`Found ${hostingExisting.keywords.length} existing hosting.com keyword(s) on this topic — Opportunity Agent will avoid them`);
  } else {
    lines.push(`\nEXISTING hosting.com COVERAGE for "${topic}": None found — no cannibalism risk detected`);
    log.success("No existing hosting.com coverage on this topic");
  }

  competitors.forEach((domain, i) => {
    const data = competitorResults[i];
    if (data?.keywords?.length) {
      lines.push(`\nCOMPETITOR RANKINGS for "${topic}" — ${domain}:`);
      data.keywords.forEach((k) => {
        lines.push(
          `  "${k.keyword}" — pos ${k.best_position}, vol ${k.volume?.toLocaleString()}, KD ${k.keyword_difficulty}, traffic ${k.sum_traffic?.toLocaleString()}`
        );
      });
    }
  });

  if (!lines.length) return null;
  log.success("Ahrefs opportunity data fetched");
  return lines.join("\n");
}

async function fetchRelatedKeywords(keyword) {
  if (!AHREFS_API_KEY) return null;
  log.item(`Fetching related keywords for "${keyword}"...`);
  const data = await callAhrefs("/keywords-explorer/related-terms", {
    select: "keyword,volume,keyword_difficulty,parent_topic",
    keywords: keyword,
    country: "gb",
    limit: 20,
    order_by: "volume:desc",
  });
  if (!data?.keywords?.length) return null;
  const lines = [`RELATED KEYWORDS for "${keyword}":`];
  data.keywords.forEach((k) => {
    lines.push(`  "${k.keyword}" — vol ${k.volume?.toLocaleString()}, KD ${k.keyword_difficulty}`);
  });
  log.success("Related keywords fetched");
  return lines.join("\n");
}

// ─── Slug helper ──────────────────────────────────────────────────────────────

function slugify(text) {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

// ─── Agent 1: Opportunity Agent ───────────────────────────────────────────────

async function opportunityAgent(topic, competitors, data, competitorIntel, ahrefsData) {
  log.agent("Agent 1 — Opportunity Agent");
  log.item(`Identifying best keyword/angle for: "${topic}"`);

  const companyContext = `
hosting.com context:
- European hosting company, ~€${(data.kpis.mrr / 1000).toFixed(0)}k MRR
- Content team: ${data.team.breakdown.content_writers} writers
- Organic conversion: ${data.kpis.organic_conversion_pct}% (target ${data.kpis.organic_conversion_target_pct}%)
- CAC: €${data.kpis.cac_actual} (budget €${data.kpis.cac_budget})
- Strategic priorities: ${data.strategic_priorities.join("; ")}
`.trim();

  const systemPrompt = `You are a senior SEO content strategist specialising in the European hosting market.
Your job is to analyse a topic and identify the single best content opportunity for hosting.com — the specific keyword and angle that will drive the most qualified organic traffic.

You evaluate opportunities on:
- Search volume and trend direction
- Keyword difficulty vs. hosting.com's current domain authority
- Search intent match (commercial > informational for conversion goals)
- Gap between what competitors cover and what hosting.com can credibly own
- Strategic fit with the company's European positioning and GDPR/trust angles
- E-E-A-T viability — can hosting.com speak with genuine authority here?

IMPORTANT: The Ahrefs data includes an "EXISTING hosting.com COVERAGE" section listing keywords hosting.com already ranks for on this topic. You must NOT recommend any of those keywords as the primary target — doing so would cause keyword cannibalism and split ranking signals across two pages. Instead, find an adjacent gap: a related keyword with a different intent, a more specific long-tail variant, or a cluster angle the existing page doesn't cover.

Return a structured opportunity brief:
1. Recommended primary keyword (must NOT appear in the existing hosting.com coverage list)
2. Estimated monthly search volume and KD score
3. Search intent (informational / commercial / transactional)
4. Why hosting.com can win this (competitive gap, unique angle)
5. Best content type (guide, comparison, tutorial, landing page)
6. 2–3 secondary cluster opportunities to build around this
7. Cannibalism check: confirm the chosen keyword does not conflict with existing hosting.com pages, and note any pages that should be internally linked to from the new article
8. Risk factors (existing strong competition, monetisation uncertainty, etc.)`;

  const liveData = ahrefsData
    ? `\nLIVE AHREFS DATA:\n${ahrefsData}\n`
    : "\nNote: No live Ahrefs data — use your knowledge of the European hosting search landscape.\n";

  const competitorSection = competitorIntel
    ? `\nCOMPETITOR INTELLIGENCE (summary):\n${competitorIntel.slice(0, 3000)}\n`
    : "\nCOMPETITOR INTELLIGENCE: Not available — run competitor-intel-agent.js to generate.\n";

  const userPrompt = `Identify the best content opportunity for hosting.com on the topic: "${topic}"

COMPANY CONTEXT:
${companyContext}
${liveData}${competitorSection}
Competitors being tracked: ${competitors.join(", ")}

Return a clear opportunity analysis. Be specific — name the exact primary keyword to target, not just the topic.`;

  const response = await client.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 1500,
    system: [{ type: "text", text: systemPrompt, cache_control: { type: "ephemeral" } }],
    messages: [{ role: "user", content: userPrompt }],
  });

  const result = response.content[0].type === "text" ? response.content[0].text : "";
  log.subsection("Opportunity Analysis:");
  console.log(result);
  return result;
}

// ─── Agent 2: Brief Agent ─────────────────────────────────────────────────────

async function briefAgent(topic, opportunityAnalysis, relatedKeywords) {
  log.agent("Agent 2 — Brief Agent");
  log.item("Building content brief...");

  const systemPrompt = `You are a senior content strategist who writes precise, actionable content briefs for a professional writing team.

Your briefs are used directly by writers — they must be specific enough that a writer can execute without follow-up questions.

A complete brief includes:
- Target keyword and confirmed search intent
- Reader persona with specific pain points and prior knowledge level
- H1 recommendation (a real, optimised title — not just the topic)
- Recommended H2 structure with guidance notes per section (what to cover, what NOT to cover, approximate word count per section)
- Total target word count with justification against competing content
- Unique angle that differentiates from the top 3 ranking competitors
- Secondary keywords to weave in naturally (do not force them)
- Internal links to suggest (format: [link to: page name])
- SERP features to target (featured snippet format, FAQ schema, etc.)
- What NOT to write (common mistakes or angles to avoid)
- Recommended call-to-action

Output the brief in a clean structured format, ready to hand directly to a writer.`;

  const relatedSection = relatedKeywords
    ? `\nRELATED KEYWORDS (secondary/LSI — weave in naturally where relevant):\n${relatedKeywords}\n`
    : "\nNote: No live related keyword data — infer secondary keywords from the opportunity analysis.\n";

  const userPrompt = `Write a complete content brief based on this opportunity analysis:

OPPORTUNITY ANALYSIS:
${opportunityAnalysis}

TOPIC: "${topic}"
${relatedSection}
The article is for hosting.com — a European hosting company known for trust, GDPR compliance, and genuine human support. The writer is skilled but not a hosting expert — the brief must guide their angle and depth, not just list headings.`;

  const response = await client.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 2500,
    system: [{ type: "text", text: systemPrompt, cache_control: { type: "ephemeral" } }],
    messages: [{ role: "user", content: userPrompt }],
  });

  const result = response.content[0].type === "text" ? response.content[0].text : "";
  log.subsection("Content Brief:");
  console.log(result);
  return result;
}

// ─── Agent 3: EEAT Agent ──────────────────────────────────────────────────────

async function eeatAgent(brief) {
  log.agent("Agent 3 — EEAT Agent");
  log.item("Reviewing brief for E-E-A-T signals...");

  const systemPrompt = `You are a senior SEO editor specialising in Google's E-E-A-T (Experience, Expertise, Authoritativeness, Trustworthiness) framework.

You review content briefs and add a layer of EEAT enhancement — specific, actionable guidance that lifts generic AI-generated content into something Google recognises as genuinely authoritative.

Most AI content fails on E-E-A-T because it:
- Makes claims without citing verifiable sources
- Lacks first-person experience signals
- Uses vague authority language ("experts say") instead of named sources
- Misses nuance that real practitioners know
- Doesn't reflect the brand's unique lived experience and positioning

Your output is an EEAT enhancement layer to attach to the brief — a set of specific instructions, not a rewrite. Writers read this alongside the brief and apply it throughout.`;

  const userPrompt = `Review this content brief and produce an EEAT enhancement layer:

CONTENT BRIEF:
${brief}

The site is hosting.com — a European hosting company. Their genuine EEAT assets include:
- European infrastructure and data centres (GDPR-compliant by design, not retrofitted)
- Years of experience hosting European SMEs across multiple countries
- Real human support team with named experts (not just chatbots)
- Pricing transparency — no introductory-rate-then-renewal-shock model
- Technical depth from an in-house engineering team

Produce the EEAT layer with these sections:
1. **Experience signals** — specific real scenarios or use cases hosting.com can speak to from lived experience (e.g. "a customer migrated from X and faced Y — here's what we saw")
2. **Expertise signals** — technical specifics, precise data, industry terminology that signals genuine depth (not surface-level Wikipedia recapping)
3. **Authoritativeness signals** — third-party sources to cite, industry bodies or regulators to reference, external data to link to
4. **Trust signals** — specific trust elements to call out (certifications, guarantees, support SLAs, data handling specifics)
5. **Red flags to avoid** — vague claims, unverifiable statistics, or generic phrasing that signals thin content to Google
6. **The European differentiator** — the single strongest thing hosting.com can say that no US-headquartered competitor can credibly claim`;

  const response = await client.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 1500,
    system: [{ type: "text", text: systemPrompt, cache_control: { type: "ephemeral" } }],
    messages: [{ role: "user", content: userPrompt }],
  });

  const result = response.content[0].type === "text" ? response.content[0].text : "";
  log.subsection("EEAT Enhancement Layer:");
  console.log(result);
  return result;
}

// ─── Agent 4: Writer Agent ────────────────────────────────────────────────────

async function writerAgent(topic, brief, eeatLayer) {
  log.agent("Agent 4 — Writer Agent");
  log.item("Writing article...");

  const systemPrompt = `You are an expert content writer specialising in B2B and SME-facing content for the European hosting and cloud infrastructure market.

You write for hosting.com. Your voice is:
- Confident but not salesy
- Technically accurate but accessible to non-developers
- Genuinely helpful — you answer the real question, not a watered-down version
- European in perspective — GDPR, EU data residency, and European business norms woven in naturally, not as buzzwords
- Honest about trade-offs — you don't pretend every scenario suits every customer

Rules:
- Follow the content brief exactly: headings, structure, word count targets, angle
- Do NOT add sections not in the brief
- Incorporate EEAT guidance throughout — woven into prose naturally, not as a visible checklist
- Open with value immediately — no throat-clearing introductions

Output format:
---
target_keyword: [the primary keyword]
meta_description: [150–160 chars, includes target keyword, compelling]
suggested_slug: [url-friendly slug]
internal_links_to_add: [comma-separated list of internal page targets]
---

Then the full article in markdown. H1 as #, H2s as ##, H3s as ### where appropriate.`;

  const userPrompt = `Write the full article for hosting.com.

TOPIC: "${topic}"

CONTENT BRIEF:
${brief}

EEAT ENHANCEMENT LAYER:
${eeatLayer}

Write the complete article now. Follow the brief's heading structure and word count targets. The EEAT guidance should feel like it came from the writer's own expertise and experience — not like a checklist was ticked off.`;

  const response = await client.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 4000,
    system: [{ type: "text", text: systemPrompt, cache_control: { type: "ephemeral" } }],
    messages: [{ role: "user", content: userPrompt }],
  });

  const result = response.content[0].type === "text" ? response.content[0].text : "";
  log.subsection("Article:");
  console.log(result);
  return result;
}

// ─── Orchestration ────────────────────────────────────────────────────────────

async function runContentPipeline(topic, competitors) {
  log.section("hosting.com Content Creation Pipeline");
  console.log(
    `${colors.dim}Topic: "${topic}" | Competitors: ${competitors.join(", ")}${colors.reset}`
  );

  const data = loadData();
  const competitorIntel = loadCompetitorIntel();

  // Fetch Ahrefs data before agents start
  log.section("Fetching Data");
  const ahrefsData = await fetchOpportunityData(topic, competitors);

  // Agents run sequentially — each feeds the next
  log.section("Running Agents");

  const opportunity = await opportunityAgent(
    topic,
    competitors,
    data,
    competitorIntel,
    ahrefsData
  );

  // Fetch related keywords while we have the opportunity output
  const relatedKeywords = await fetchRelatedKeywords(topic);

  const brief = await briefAgent(topic, opportunity, relatedKeywords);
  const eeatLayer = await eeatAgent(brief);
  const article = await writerAgent(topic, brief, eeatLayer);

  // Save outputs
  log.section("Saving Outputs");

  if (!fs.existsSync(OUTPUT_DIR)) fs.mkdirSync(OUTPUT_DIR, { recursive: true });

  const slug = slugify(topic);
  const timestamp = Date.now();
  const briefPath = path.join(OUTPUT_DIR, `${slug}-brief-${timestamp}.json`);
  const articlePath = path.join(OUTPUT_DIR, `${slug}-article-${timestamp}.md`);

  const briefReport = {
    timestamp: new Date().toISOString(),
    topic,
    competitors,
    opportunityAnalysis: opportunity,
    contentBrief: brief,
    eeatLayer,
    metadata: { slug, targetDomain: TARGET_DOMAIN },
  };

  fs.writeFileSync(briefPath, JSON.stringify(briefReport, null, 2));
  fs.writeFileSync(articlePath, article);

  log.success(`Brief + EEAT saved: content/${path.basename(briefPath)}`);
  log.success(`Article saved:      content/${path.basename(articlePath)}`);

  log.section("Pipeline Complete");
  log.success("All 4 agents completed.");
  console.log(`\n${colors.dim}Next steps:${colors.reset}`);
  console.log(`  1. Review article:  content/${path.basename(articlePath)}`);
  console.log(`  2. Check internal link targets in the metadata block at the top of the article`);
  console.log(`  3. Writer does a final brand voice pass`);
  console.log(`  4. Run through your CMS review process before publishing\n`);
}

// ─── CLI Entry Point ──────────────────────────────────────────────────────────

async function main() {
  const args = process.argv.slice(2);

  const topicArg = args.find((a) => a.startsWith("--topic="));
  if (!topicArg) {
    console.error(`${colors.red}Error:${colors.reset} --topic is required`);
    console.error(`Usage: node content-pipeline.js --topic="gdpr compliant hosting"`);
    process.exit(1);
  }
  const topic = topicArg.split("=").slice(1).join("=");

  const data = loadData();
  const competitorArg = args.find((a) => a.startsWith("--competitors="));
  const competitors = competitorArg
    ? competitorArg.split("=").slice(1).join("=").split(",").map((s) => s.trim())
    : data.competitors.map((c) => new URL(c.homepage).hostname.replace("www.", ""));

  await runContentPipeline(topic, competitors);
}

main().catch((err) => {
  console.error(`${colors.red}Fatal error:${colors.reset}`, err.message);
  process.exit(1);
});
