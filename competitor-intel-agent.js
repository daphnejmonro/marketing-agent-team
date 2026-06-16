#!/usr/bin/env node
require("dotenv").config({ quiet: true });

/**
 * Competitor Intelligence Agent for hosting.com
 *
 * Scrapes competitor homepages and pricing pages, then uses Claude to produce
 * a structured competitive analysis saved to competitor-intel.json.
 *
 * That file is automatically picked up by hosting-marketing-ops-hub.js and
 * hosting-seo-agent-system.js on their next run.
 *
 * Usage:
 *   node competitor-intel-agent.js                         # scrape all from data.json
 *   node competitor-intel-agent.js --url=https://rival.com # ad-hoc single URL
 */

if (typeof File === "undefined") { global.File = require("buffer").File; }

const Anthropic = require("@anthropic-ai/sdk");
const axios = require("axios");
const cheerio = require("cheerio");
const fs = require("fs");
const path = require("path");

require("./check-setup")();
const client = new Anthropic.default();

const colors = {
  reset: "\x1b[0m",
  bright: "\x1b[1m",
  dim: "\x1b[2m",
  cyan: "\x1b[36m",
  green: "\x1b[32m",
  yellow: "\x1b[33m",
  red: "\x1b[31m",
  magenta: "\x1b[35m",
};

const log = {
  section: (title) =>
    console.log(`\n${colors.bright}${colors.cyan}╔═══ ${title} ═══╗${colors.reset}`),
  subsection: (title) =>
    console.log(`\n${colors.bright}${colors.magenta}▶ ${title}${colors.reset}`),
  agent: (name) =>
    console.log(`\n${colors.bright}${colors.green}  → ${name}${colors.reset}`),
  item: (text) => console.log(`    ${text}`),
  success: (text) => console.log(`    ${colors.green}✓${colors.reset} ${text}`),
  warning: (text) => console.log(`    ${colors.yellow}⚠${colors.reset} ${text}`),
  error: (text) => console.log(`    ${colors.red}✗${colors.reset} ${text}`),
};

function loadData() {
  const dataPath = path.join(__dirname, "data.json");
  // Fall back to the bundled demo data so a fresh download runs immediately.
  const filePath = fs.existsSync(dataPath)
    ? dataPath
    : path.join(__dirname, "WEBINAR_DEMO_DATA.json");
  if (!fs.existsSync(filePath)) {
    console.error("\x1b[31mError:\x1b[0m data.json not found.");
    process.exit(1);
  }
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

const HEADERS = {
  "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
  "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
  "Accept-Language": "en-GB,en;q=0.9",
};

async function scrapePage(url) {
  const response = await axios.get(url, { timeout: 12000, headers: HEADERS });
  const $ = cheerio.load(response.data);

  $("script, style, noscript").remove();

  const title = $("title").text().trim();
  const metaDesc = $('meta[name="description"]').attr("content") || "";
  const h1s = $("h1").map((_, el) => $(el).text().trim()).get().filter(Boolean).join(" | ");
  const h2s = $("h2").map((_, el) => $(el).text().trim()).get().filter(Boolean).slice(0, 8).join(" | ");

  const ctaButtons = $('button, [class*="cta"], [class*="btn"], [class*="button"]')
    .map((_, el) => $(el).text().trim())
    .get()
    .filter((t) => t.length > 1 && t.length < 60)
    .slice(0, 10)
    .join(" | ");

  const navLinks = $("nav a, header a")
    .map((_, el) => $(el).text().trim())
    .get()
    .filter(Boolean)
    .slice(0, 12)
    .join(" | ");

  return { title, metaDesc, h1s, h2s, ctaButtons, navLinks };
}

async function scrapePricingPage(url) {
  const response = await axios.get(url, { timeout: 12000, headers: HEADERS });
  const $ = cheerio.load(response.data);

  $("script, style, noscript").remove();

  const planNames = $("h2, h3, h4")
    .map((_, el) => $(el).text().trim())
    .get()
    .filter(Boolean)
    .slice(0, 15)
    .join(" | ");

  const bodyText = $("body").text().replace(/\s+/g, " ");
  const priceMatches = bodyText.match(/[€$£]\s*\d+[\d.,]*/g) || [];
  const prices = [...new Set(priceMatches)].slice(0, 20).join(", ");

  const features = $("li")
    .map((_, el) => $(el).text().trim())
    .get()
    .filter((t) => t.length > 3 && t.length < 120)
    .slice(0, 25)
    .join(" | ");

  return { planNames, prices, features };
}

async function scrapeCompetitor(competitor) {
  log.item(`Scraping ${competitor.name}...`);

  const [homepage, pricing] = await Promise.allSettled([
    scrapePage(competitor.homepage),
    scrapePricingPage(competitor.pricing),
  ]);

  const result = { name: competitor.name };

  if (homepage.status === "fulfilled") {
    result.homepage = homepage.value;
    log.success(`${competitor.name} homepage scraped`);
  } else {
    result.homepageError = homepage.reason.message;
    log.warning(`${competitor.name} homepage: ${homepage.reason.message}`);
  }

  if (pricing.status === "fulfilled") {
    result.pricing = pricing.value;
    log.success(`${competitor.name} pricing page scraped`);
  } else {
    result.pricingError = pricing.reason.message;
    log.warning(`${competitor.name} pricing: ${pricing.reason.message}`);
  }

  return result;
}

function formatScrapedData(scrapedCompetitors) {
  return scrapedCompetitors.map((c) => {
    const hp = c.homepage;
    const pr = c.pricing;

    const homepageSection = hp
      ? `  Title: ${hp.title || "N/A"}
  Meta description: ${hp.metaDesc || "N/A"}
  H1: ${hp.h1s || "N/A"}
  Key headings: ${hp.h2s || "N/A"}
  CTAs/buttons: ${hp.ctaButtons || "N/A"}
  Navigation: ${hp.navLinks || "N/A"}`
      : `  HOMEPAGE BLOCKED: ${c.homepageError || "unknown error"}`;

    const pricingSection = pr
      ? `  Plan names: ${pr.planNames || "N/A"}
  Prices found: ${pr.prices || "N/A"}
  Features listed: ${pr.features || "N/A"}`
      : `  PRICING BLOCKED: ${c.pricingError || "unknown error"}`;

    return `=== ${c.name} ===\nHOMEPAGE:\n${homepageSection}\n\nPRICING PAGE:\n${pricingSection}`;
  }).join("\n\n");
}

async function analyseWithClaude(scrapedCompetitors, hostingContext) {
  log.agent("Claude Analysis Agent");

  const scrapedText = formatScrapedData(scrapedCompetitors);

  const systemPrompt = `You are a competitive intelligence analyst for hosting.com, a European web hosting company.
Your job is to turn raw scraped competitor data into clear, actionable insights for the marketing team.
hosting.com context: MRR €${(hostingContext.kpis.mrr / 1000).toFixed(0)}k, CAC €${hostingContext.kpis.cac_actual} (budget €${hostingContext.kpis.cac_budget}), organic conversion ${hostingContext.kpis.organic_conversion_pct}% (target ${hostingContext.kpis.organic_conversion_target_pct}%), affiliate revenue ${hostingContext.affiliate.revenue_pct_mrr}% of MRR (target ${hostingContext.affiliate.revenue_target_pct}%).`;

  const userPrompt = `Analyse these competitor websites scraped today:

${scrapedText}

Provide a structured competitive intelligence report:

1. PRICING COMPARISON
   - Table of plan names, prices, and key features across competitors
   - Where is hosting.com underpriced or overpriced relative to the market?
   - Any promotional pricing or trial offers competitors are running?

2. MESSAGING & CTA PATTERNS
   - What core value propositions are competitors leading with?
   - What CTA language dominates? (speed, price, support, reliability?)
   - Any messaging gaps hosting.com could own?

3. CONTENT ANGLES
   - What topics, landing page types, or content formats are competitors pushing?
   - Where are they strong that hosting.com is weak?
   - What do they not cover that hosting.com could lead on?

4. OPPORTUNITIES FOR hosting.com
   - Top 3 pricing or positioning gaps to exploit
   - Top 3 content or SEO angles not owned by competitors
   - Any weak spots in their messaging or product framing?

5. IMMEDIATE ACTIONS
   - 3 specific things the marketing team should do this month based on this intel`;

  const response = await client.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 3000,
    system: systemPrompt,
    messages: [{ role: "user", content: userPrompt }],
  });

  const analysis = response.content[0].type === "text" ? response.content[0].text : "";
  log.subsection("Competitive Analysis:");
  log.item(analysis);
  return analysis;
}

async function runCompetitorIntelPipeline(competitorList) {
  log.section("hosting.com Competitor Intelligence Agent");
  const data = loadData();

  const competitors = competitorList || data.competitors;
  if (!competitors || competitors.length === 0) {
    log.error("No competitors found. Add a 'competitors' array to data.json.");
    process.exit(1);
  }

  console.log(`${colors.dim}Scraping ${competitors.length} competitor sites...${colors.reset}`);

  const scrapedCompetitors = [];
  for (const competitor of competitors) {
    try {
      const result = await scrapeCompetitor(competitor);
      scrapedCompetitors.push(result);
    } catch (err) {
      log.error(`${competitor.name} failed entirely: ${err.message}`);
      scrapedCompetitors.push({ name: competitor.name, fatalError: err.message });
    }
  }

  const analysis = await analyseWithClaude(scrapedCompetitors, data);

  const report = {
    timestamp: new Date().toISOString(),
    competitors: scrapedCompetitors,
    analysis,
  };

  const outputPath = path.join(__dirname, "competitor-intel.json");
  fs.writeFileSync(outputPath, JSON.stringify(report, null, 2));

  log.section("Complete");
  log.success(`Competitor intel saved to: ${outputPath}`);
  log.item("Run hosting-marketing-ops-hub.js or hosting-seo-agent-system.js to use this intel.");

  return report;
}

async function main() {
  const args = process.argv.slice(2);
  const urlArg = args.find((a) => a.startsWith("--url="));

  if (urlArg) {
    const url = urlArg.split("=")[1];
    const name = new URL(url).hostname.replace("www.", "");
    await runCompetitorIntelPipeline([{ name, homepage: url, pricing: url }]);
  } else {
    await runCompetitorIntelPipeline();
  }
}

main().catch((err) => {
  console.error(`${colors.red}Fatal error:${colors.reset}`, err.message);
  process.exit(1);
});
