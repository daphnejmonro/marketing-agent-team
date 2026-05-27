#!/usr/bin/env node

/**
 * hosting.com Daily Briefing
 * 
 * Quick intelligence synthesis for Daphne's morning standup.
 * Run: node daily-briefing.js [--detailed] [--focus=seo|cro|content|affiliate]
 * 
 * Output: 5-10 minute read covering:
 * - KPI snapshot (status vs. targets)
 * - Today's top priority
 * - Team blockers
 * - Risk alerts
 * - Decision needed
 */

if (typeof File === "undefined") { global.File = require("buffer").File; }

const Anthropic = require("@anthropic-ai/sdk");
const fs = require("fs");
const path = require("path");

const client = new Anthropic.default();

function loadData() {
  const dataPath = path.join(__dirname, "data.json");
  if (!fs.existsSync(dataPath)) {
    console.error(
      "\x1b[31mError:\x1b[0m data.json not found. Copy the template:\n  cp data.json.example data.json\nThen update it with your real numbers."
    );
    process.exit(1);
  }
  return JSON.parse(fs.readFileSync(dataPath, "utf8"));
}

const data = loadData();

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

const today = new Date().toLocaleDateString("en-GB", {
  weekday: "long",
  year: "numeric",
  month: "long",
  day: "numeric",
});

async function callClaude(systemPrompt, userPrompt) {
  const response = await client.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 1500,
    system: systemPrompt,
    messages: [{ role: "user", content: userPrompt }],
  });
  return response.content[0].type === "text" ? response.content[0].text : "";
}

async function generateBriefing(focusArea) {
  console.log(
    `\n${colors.bright}${colors.cyan}hosting.com Daily Briefing${colors.reset}`
  );
  console.log(`${colors.dim}${today}${colors.reset}\n`);

  const systemPrompt = `You are Daphne's morning intelligence briefing AI.
Synthesize the day ahead in 5 minutes (500-700 words). Be direct: lead with the most important item.

Format:
1. KPI snapshot (one sentence each: MRR, CAC, organic conv%, ROAS—vs. target)
2. Search Console snapshot (clicks, impressions, avg CTR, avg position — flag anything notable vs. typical expectations for a hosting.com site)
3. Top queries/pages by clicks (only include this section if query or page breakdown data is provided — skip if only aggregate totals are available)
4. Today's priority (one clear focus)
5. Team blockers (what's stuck?)
6. Decision needed (yes/no, approve/reject, allocate/defer)
7. Risk alert (anything that needs immediate attention?)
8. Quick wins (what's low-effort, high-impact today?)

Tone: Executive, actionable, no fluff.`;

  const { kpis, content, cro, affiliate, blockers, upcoming } = data;
  const cacStatus = kpis.cac_actual > kpis.cac_budget
    ? `⚠ ${Math.round(((kpis.cac_actual - kpis.cac_budget) / kpis.cac_budget) * 100)}% over target`
    : "✓ On target";
  const convStatus = kpis.organic_conversion_pct < kpis.organic_conversion_target_pct
    ? `⚠ Plateau since ${kpis.organic_conversion_plateau_since}`
    : "✓ On target";

  // Build Search Console section if available
  const sc = data.search_console;
  const scTop = sc && sc.top_10 && sc.top_10.length > 0
    ? `\n- Top ${sc.top_10.length} ${sc.dimension_type}s by clicks:\n` +
      sc.top_10.map((r, i) => `  ${i + 1}. "${r.dimension}" — ${r.clicks} clicks, pos ${r.position}, CTR ${r.ctr}%`).join("\n")
    : "";
  const scSection = sc ? `
Search Console data (${sc.date}):
- Total clicks: ${sc.total_clicks.toLocaleString()}
- Total impressions: ${sc.total_impressions.toLocaleString()}
- Avg CTR: ${sc.avg_ctr_pct}%
- Avg position: ${sc.avg_position}${scTop}
` : "Search Console data: not yet available (run node sync-sheet.js first).";

  const userPrompt = `Generate Daphne's daily briefing for ${today}.

Context:
- MRR: €${(kpis.mrr / 1000).toFixed(0)}k (target: grow ${kpis.mrr_growth_target_yoy_pct}% YoY) ✓ ${kpis.mrr_status}
- CAC: €${kpis.cac_actual} (budget: €${kpis.cac_budget}) ${cacStatus}
- LTV: €${kpis.ltv.toLocaleString()} (${kpis.ltv_cac_ratio} ratio) ✓
- ROAS: ${kpis.roas_actual}x (target: ${kpis.roas_target}x) ✓
- Organic conversion: ${kpis.organic_conversion_pct}% (target: ${kpis.organic_conversion_target_pct}%) ${convStatus}
- Content output: ${content.output_this_month}/${content.output_target_monthly} for this month
- CRO: ${cro.active_tests} tests running, looking for 0.5%+ lift to hit ${kpis.organic_conversion_target_pct}%
- Affiliate revenue: ${affiliate.revenue_pct_mrr}% of MRR (target: ${affiliate.revenue_target_pct}% by ${affiliate.revenue_target_quarter})
- Content review cycle: ${content.review_cycle_days}d (target: ${content.review_cycle_target_days}d)
${upcoming.length ? `- Upcoming: ${upcoming.join(", ")}` : ""}
${blockers.length ? `\nKey blockers:\n${blockers.map(b => `- ${b}`).join("\n")}` : ""}

${scSection}

${focusArea !== "all" ? `Focus area: ${focusArea}` : ""}

What should Daphne focus on TODAY to move the needle?`;

  const briefing = await callClaude(systemPrompt, userPrompt);
  console.log(briefing);
  console.log(
    `\n${colors.dim}---\nUse 'claude daily-briefing.js --detailed' for full analysis${colors.reset}\n`
  );
}

async function generateDetailedAnalysis(focusArea) {
  console.log(
    `\n${colors.bright}${colors.magenta}Detailed Analysis: ${focusArea.toUpperCase()}${colors.reset}\n`
  );

  const analysisPrompts = {
    seo: `You are Daphne's SEO strategist. Give her a 2-minute deep dive on:
1. GEO/LLM optimization opportunities for this quarter
2. Top 3 technical SEO improvements needed
3. Content clusters to develop
4. Expected impact on organic conversion`,
    cro: `You are the CRO director. Detailed analysis:
1. Why is organic conversion stuck at 4.2%?
2. Top 3 experiments to run this sprint
3. Team workload & timeline
4. Expected lift to reach 5%`,
    content: `You are the content ops lead. Breakdown:
1. Content calendar status (on track?)
2. Which pieces drive the most revenue?
3. GEO/LLM angle coverage (%)
4. Affiliate alignment (which partners benefit from new content?)`,
    affiliate: `You are the affiliate director. Strategic analysis:
1. Partner health (who's growing, who's at risk?)
2. Recruitment pipeline
3. Commission optimization (where can we increase leverage?)
4. Co-marketing opportunities with top 3 partners`,
  };

  const systemPrompt = `You are a strategic expert in ${focusArea}.
Give Daphne 3-5 actionable insights with specific next steps.
Format: Issue | Root cause | Recommended action | Expected impact | Owner.`;

  const prompt =
    analysisPrompts[focusArea] ||
    analysisPrompts.seo;

  const analysis = await callClaude(systemPrompt, prompt);
  console.log(analysis);
  console.log("\n");
}

// CLI
async function main() {
  const args = process.argv.slice(2);
  const isDetailed = args.includes("--detailed");
  const focusArg = args.find((arg) => arg.startsWith("--focus="));
  const focus = focusArg ? focusArg.split("=")[1] : "all";

  try {
    await generateBriefing(focus);

    if (isDetailed && focus !== "all") {
      await generateDetailedAnalysis(focus);
    }
  } catch (error) {
    console.error(`${colors.red}Error:${colors.reset}`, error.message);
    process.exit(1);
  }
}

main();
