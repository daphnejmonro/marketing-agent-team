#!/usr/bin/env node

/**
 * hosting.com Marketing Operations Hub
 * 
 * Multi-agent system for managing:
 * - SEO operations (technical + content + strategy)
 * - Content pipeline & editorial calendar
 * - CRO experiments & optimization
 * - Team capacity & workload
 * - KPI tracking & board reporting
 * 
 * Architecture:
 * 1. Domain specialists (SEO, Content, CRO agents)
 * 2. Manager agent (synthesizes across domains)
 * 3. Operations agent (team capacity, scheduling, dependencies)
 * 4. Executive agent (board reporting, stakeholder comms)
 */

if (typeof File === "undefined") { global.File = require("buffer").File; }

const Anthropic = require("@anthropic-ai/sdk");
const fs = require("fs");
const path = require("path");

function loadData() {
  const dataPath = path.join(__dirname, "data.json");
  if (!fs.existsSync(dataPath)) {
    console.error(
      "\x1b[31mError:\x1b[0m data.json not found.\nUpdate it with your real numbers before running this script."
    );
    process.exit(1);
  }
  return JSON.parse(fs.readFileSync(dataPath, "utf8"));
}

const data = loadData();

const client = new Anthropic.default();

// ============================================================================
// UTILITIES
// ============================================================================

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
    console.log(
      `\n${colors.bright}${colors.cyan}╔═══ ${title} ═══╗${colors.reset}`
    ),
  subsection: (title) =>
    console.log(`\n${colors.bright}${colors.magenta}▶ ${title}${colors.reset}`),
  agent: (name) =>
    console.log(`\n${colors.bright}${colors.green}  → ${name}${colors.reset}`),
  item: (text) => console.log(`    ${text}`),
  success: (text) =>
    console.log(`    ${colors.green}✓${colors.reset} ${text}`),
  warning: (text) =>
    console.log(`    ${colors.yellow}⚠${colors.reset} ${text}`),
  error: (text) => console.log(`    ${colors.red}✗${colors.reset} ${text}`),
};

async function callClaude(systemPrompt, userPrompt, maxTokens = 2000) {
  const response = await client.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: maxTokens,
    system: systemPrompt,
    messages: [{ role: "user", content: userPrompt }],
  });
  return response.content[0].type === "text" ? response.content[0].text : "";
}

// Context loaded from data.json — edit that file to update your numbers

// ============================================================================
// AGENT 1: Content Pipeline Manager
// ============================================================================

async function contentPipelineAgent(contentCalendarData) {
  log.agent("Content Pipeline Manager");

  const systemPrompt = `You are the Content Operations Manager for hosting.com.
You oversee the 6-person content team and ensure:
- Editorial calendar adherence (target: 14-16 pieces/month)
- Content quality gates (review cycle: 3-4 days target)
- Keyword-content mapping (no gaps, no cannibalization)
- Pillar-cluster architecture (semantic coherence)
- GEO/LLM optimization (per Daphne's specialization)
- Affiliate partner content (which pieces benefit top partners)
- Publication velocity & demand-gen impact

Analyze the pipeline and provide:
1. Bottleneck analysis (what's slowing approval?)
2. Upcoming deadlines & at-risk pieces
3. Content rebalancing (what types underperform)
4. Affiliate alignment (which pieces serve which partners)
5. Recommendations for the content team`;

  const userPrompt = `Analyze our current content pipeline:
${contentCalendarData}

Focus on:
- Are we on track for 14-16 pieces this month?
- Which pieces are blocked and why?
- Which content types (guide, comparison, tutorial, case study) drive the most revenue?
- Are we optimizing for GEO/LLM best practices?
- Which content should we prioritize for affiliate partners?`;

  const result = await callClaude(systemPrompt, userPrompt);
  log.subsection("Content Pipeline Analysis:");
  log.item(result);
  return result;
}

// ============================================================================
// AGENT 2: CRO Strategy Specialist
// ============================================================================

async function croStrategyAgent(currentExperiments, conversionMetrics) {
  log.agent("CRO Strategy Specialist");

  const systemPrompt = `You are the Chief Conversion Rate Optimization (CRO) Strategist for hosting.com.
Your mandate: break the 4.2% organic conversion plateau and reach 5%.

You analyze:
- Current A/B test results (statistical significance, impact)
- Conversion funnel bottlenecks (where do visitors drop?)
- User behavior signals (scroll depth, heatmaps, session recordings)
- Friction points (form fields, page load, decision clarity)
- Psychological triggers (scarcity, social proof, trustworthiness)
- Personalization opportunities (by device, geography, traffic source)

Your framework (2026 CRO):
1. High-impact tests (potential 0.5%+ lift)
2. Low-effort tests (can launch in 1-2 weeks)
3. Quick wins (copy changes, visual tweaks, micro-interactions)
4. Structural changes (requires dev collaboration)

Provide prioritized test roadmap with expected lift, effort, and team allocation.`;

  const userPrompt = `Analyze our CRO situation:
${currentExperiments}

Conversion metrics:
${conversionMetrics}

We're stuck at 4.2% organic conversion (target: 5%).

Recommend:
1. Top 3 high-impact experiments (>0.5% lift potential)
2. Quick wins (launch this month)
3. Structural changes (next quarter)
4. Personalization opportunities
5. Test prioritization logic (ROI-weighted)
6. Team allocation (5-person CRO team)`;

  const result = await callClaude(systemPrompt, userPrompt);
  log.subsection("CRO Strategy:");
  log.item(result);
  return result;
}

// ============================================================================
// AGENT 3: Affiliate Programme Manager
// ============================================================================

async function affiliateManagerAgent(affiliateData) {
  log.agent("Affiliate Programme Manager");

  const systemPrompt = `You are the Affiliate Program Director for hosting.com.
Your goal: scale affiliate revenue from 18% to 30% of total revenue while maintaining partner satisfaction.

You manage:
- Partner recruitment (pipeline, vetting, onboarding)
- Commission structures (tiered incentives, performance bonuses)
- Content enablement (affiliate-friendly assets, guides, examples)
- Partner health (active/inactive, churn signals, growth trajectories)
- Competitive analysis (what offers are partners choosing instead)

Focus on:
1. High-performing partners (TechBlog Reviews) → deeper engagement, co-marketing
2. Growth partners (Dev Community) → support, additional content
3. Struggling partners (SMB Guides) → root cause, commission adjustment, or sunset
4. New partner recruitment (targeting adjacent audiences)`;

  const userPrompt = `Analyze our affiliate programme:
${affiliateData}

Current state:
- Top partner (TechBlog Reviews): €12.4k/30d, 12% commission
- Growing partner (Dev Community): €8.2k/30d, 10% commission
- Struggling partner (SMB Guides): €2.1k/30d, 8% commission
- Revenue target: 30% of MRR (€75k/month) by Q4 2025

Recommendations:
1. Partner optimization (recruit, expand, or sunset)
2. Commission strategy (when to tier up, when to cut)
3. Content enablement (which blog posts drive affiliate revenue)
4. Co-marketing opportunities (with top 3 partners)
5. Recruitment pipeline (5-7 new partners to approach)`;

  const result = await callClaude(systemPrompt, userPrompt);
  log.subsection("Affiliate Strategy:");
  log.item(result);
  return result;
}

// ============================================================================
// AGENT 4: Operations & Capacity Planner
// ============================================================================

async function operationsAgent(teamCapacity, strategicInitiatives) {
  log.agent("Operations & Capacity Planner");

  const { breakdown } = data.team;
  const systemPrompt = `You are the Operations Director for hosting.com's marketing team.
You manage a team of 16 (plus Daphne as Head of Website & Content):
- ${breakdown.developers} developers
- ${breakdown.cro} CRO specialist
- ${breakdown.seo} SEO specialists
- ${breakdown.content_writers} content writers
- ${breakdown.spanish_content_creator} Spanish content creator
- ${breakdown.global_content_manager} global content manager
- ${breakdown.seo_content_india} SEO/content based in India
- ${breakdown.community} community managers
- ${breakdown.events} events specialist
- ${breakdown.product_marketing} product marketing expert

Your job:
1. Capacity planning (how many content pieces can we publish?)
2. Dependency mapping (what blocks what?)
3. Timeline estimation (how long for initiatives?)
4. Risk management (where are the critical paths?)
5. Resource allocation (when do we hire? outsource? defer?)

Operating constraints:
- Content review cycle currently 4.2 days (target 3.5 days)
- Dev team split between features + tech debt + performance
- Daphne reports to C-suite on MRR, CAC, LTV, ROAS, organic conversion`;

  const userPrompt = `Plan current quarter operations:

Team capacity:
${teamCapacity}

Strategic initiatives for Q2:
${strategicInitiatives}

Questions:
1. Can we hit all strategic goals with current headcount?
2. Which initiatives conflict or have dependencies?
3. When should we hire/outsource (e.g., more content, CRO testing infrastructure)?
4. What's the critical path to reach 5% organic conversion?
5. What's the minimum effort to hit MRR growth targets?
6. Risk management: what could derail the plan?`;

  const result = await callClaude(systemPrompt, userPrompt, 2500);
  log.subsection("Operations Plan:");
  log.item(result);
  return result;
}

// ============================================================================
// AGENT 5: Executive/Board Reporting
// ============================================================================

async function executiveAgent(kpis, initiatives, risks) {
  log.agent("Executive Affairs & Board Reporting");

  const systemPrompt = `You are the Chief Marketing Officer's strategic advisor.
You prepare Daphne (Head of Website & Content) for board meetings and C-suite updates.

Your role:
1. Synthesize KPI trends into board-ready narratives
2. Identify risks + mitigation strategies
3. Celebrate wins & contextualize challenges
4. Project forward (next quarter, next year)
5. Recommend strategic pivots or resource reallocations

Tone: Confident, data-driven, action-oriented. Board members are investors/execs; they care about:
- Revenue impact (MRR, growth rate)
- Unit economics (CAC, LTV, payback period)
- Market positioning (competitive advantage)
- Team capability (can you execute?)
- Risk management (what could go wrong?)`;

  const upcomingStr = data.upcoming && data.upcoming.length ? data.upcoming.join(", ") : "TBD";
  const userPrompt = `Prepare board/exec update for Daphne:

Current KPIs:
${kpis}

Strategic initiatives:
${initiatives}

Risks:
${risks}

Upcoming: ${upcomingStr}
Time allocation: 15 minutes (12 min presentation, 3 min Q&A)

Generate:
1. Opening (1 min): headline, headline metric, confidence level
2. KPI review (4 min): What moved? Why? vs. expectations
3. Initiatives (4 min): Major moves, progress, timeline
4. Risks (2 min): Top 2 risks, mitigation
5. Ask (1 min): Do we need board help/approval on anything?

Format as a presenter's script (conversational, not slides).`;

  const result = await callClaude(systemPrompt, userPrompt, 2000);
  log.subsection("Board Presentation Script:");
  log.item(result);
  return result;
}

// ============================================================================
// ORCHESTRATOR: Manager Agent (Decision-Maker)
// ============================================================================

async function managerAgent(
  contentAnalysis,
  croStrategy,
  affiliateStrategy,
  opsplan,
  boardReport,
  competitorIntel
) {
  log.agent("Manager Agent (Final Synthesis & Decision)");

  const systemPrompt = `You are Daphne Monro's strategic advisor and decision-making partner.
You review all domain experts (content, CRO, affiliate, ops, board) and provide ONE unified priority list.

Your job:
1. Identify conflicts (content vs. CRO resources?)
2. Sequencing (what must happen first?)
3. Trade-offs (ship fast vs. polish? invest in growth vs. optimize for margins?)
4. Alignment (does every initiative support MRR growth + CAC reduction + organic conversion improvement?)
5. Daphne's focus (what should she personally spend time on vs. delegate?)

Output: A weekly priority list + monthly strategic roadmap, with clear ownership and timelines.`;

  const competitorSection = competitorIntel
    ? `\nCOMPETITOR INTELLIGENCE:\n${competitorIntel}`
    : "\nCOMPETITOR INTELLIGENCE:\nNot available — run competitor-intel-agent.js to generate.";

  const userPrompt = `Synthesize all domain strategies into ONE unified priority list:

CONTENT PIPELINE:
${contentAnalysis}

CRO STRATEGY:
${croStrategy}

AFFILIATE STRATEGY:
${affiliateStrategy}

OPERATIONS PLAN:
${opsplan}

BOARD PRIORITIES:
${boardReport}
${competitorSection}

Generate:
1. This week's 5 priorities (Daphne's focus + team focus)
2. This month's initiatives (ranked by impact on KPIs)
3. Resource conflicts or resolutions
4. Success criteria (how do we know we're winning?)
5. Dashboard metrics to track daily`;

  const result = await callClaude(systemPrompt, userPrompt, 3000);
  log.subsection("Unified Strategic Priority List:");
  log.item(result);
  return result;
}

// ============================================================================
// MAIN ORCHESTRATION
// ============================================================================

function loadCompetitorIntel() {
  const intelPath = path.join(__dirname, "competitor-intel.json");
  if (!fs.existsSync(intelPath)) return null;
  try {
    const intel = JSON.parse(fs.readFileSync(intelPath, "utf8"));
    const ageMs = Date.now() - new Date(intel.timestamp).getTime();
    const ageDays = Math.floor(ageMs / (1000 * 60 * 60 * 24));
    log.success(`Competitor intel loaded (${ageDays} day${ageDays !== 1 ? "s" : ""} old)`);
    if (ageDays > 7) log.warning("Intel is over 7 days old — consider re-running competitor-intel-agent.js");
    return intel.analysis;
  } catch {
    return null;
  }
}

async function runMarketingOperationsPipeline() {
  log.section("hosting.com Marketing Operations Hub");
  console.log(`${colors.dim}Running full marketing ops analysis pipeline${colors.reset}`);
  const today = new Date().toLocaleDateString("en-GB", { weekday: "long", year: "numeric", month: "long", day: "numeric" });
  console.log(`${colors.dim}${today} | Team: ${data.team.total} people | Budget: €${(data.budget_monthly_eur / 1000).toFixed(0)}k/month${colors.reset}`);

  try {
    const { kpis, content, cro, affiliate, blockers, strategic_priorities, team } = data;

    const contentCalendarData = content.pipeline_summary;

    const currentExperiments = cro.experiments_summary;

    const conversionMetrics = `
    Organic conversion: ${kpis.organic_conversion_pct}% (plateau since ${kpis.organic_conversion_plateau_since})
    Overall goal: ${kpis.organic_conversion_target_pct}% organic (need +${(kpis.organic_conversion_target_pct - kpis.organic_conversion_pct).toFixed(1)} percentage points)
    `;

    const affiliatePartners = affiliate.top_partners
      .map(p => `${p.name} (€${(p.revenue_30d_eur / 1000).toFixed(1)}k/30d, ${p.commission_pct}% commission)`)
      .join(", ");
    const affiliateData = `
    Top partners: ${affiliatePartners}
    Total affiliate revenue: ${affiliate.revenue_pct_mrr}% of MRR (€${(affiliate.revenue_eur_monthly / 1000).toFixed(0)}k/month)
    Target: ${affiliate.revenue_target_pct}% by ${affiliate.revenue_target_quarter} (€${(affiliate.revenue_target_eur_monthly / 1000).toFixed(0)}k/month)
    `;

    const teamCapacity = `
    Content team: ${team.content} people, ${content.output_target_monthly} pieces/month capacity
    CRO team: ${team.cro} people, can run 8-10 concurrent tests
    Dev team: ${team.frontend_dev} people, split between features (50%), tech debt (30%), perf (20%)
    Constraint: Content review cycle at ${content.review_cycle_days} days (target: ${content.review_cycle_target_days})
    `;

    const strategicInitiatives = strategic_priorities.map((p, i) => `${i + 1}. ${p}`).join("\n");

    const risks = blockers.map((b, i) => `${i + 1}. ${b}`).join("\n");

    const kpis_summary = JSON.stringify({
      mrr: `€${(kpis.mrr / 1000).toFixed(0)}k`,
      mrr_growth_target: `${kpis.mrr_growth_target_yoy_pct}% YoY`,
      cac: `€${kpis.cac_actual} (budget €${kpis.cac_budget})`,
      ltv: `€${kpis.ltv.toLocaleString()} (${kpis.ltv_cac_ratio})`,
      roas: `${kpis.roas_actual}x (target ${kpis.roas_target}x)`,
      organic_conversion: `${kpis.organic_conversion_pct}% (target ${kpis.organic_conversion_target_pct}%)`,
      content_roi: kpis.content_roi,
    }, null, 2);

    // Load competitor intel if available
    const competitorIntel = loadCompetitorIntel();

    // Run pipeline
    log.subsection("Running all agents...");

    const contentAnalysis = await contentPipelineAgent(contentCalendarData);
    const croStrategy = await croStrategyAgent(
      currentExperiments,
      conversionMetrics
    );
    const affiliateStrategy = await affiliateManagerAgent(affiliateData);
    const opsplan = await operationsAgent(teamCapacity, strategicInitiatives);
    const boardReport = await executiveAgent(kpis_summary, strategicInitiatives, risks);

    // Final manager synthesis
    const finalPlan = await managerAgent(
      contentAnalysis,
      croStrategy,
      affiliateStrategy,
      opsplan,
      boardReport,
      competitorIntel
    );

    // Save report
    log.section("Pipeline Complete");
    log.success("All agents completed. Full report generated.");

    const fullReport = {
      timestamp: new Date().toISOString(),
      company: "hosting.com",
      analyses: {
        contentPipeline: contentAnalysis,
        croStrategy: croStrategy,
        affiliateStrategy: affiliateStrategy,
        operationsPlan: opsplan,
        boardReport: boardReport,
        competitorIntel: competitorIntel || "Not available",
        finalSynthesis: finalPlan,
      },
    };

    const reportPath = `hosting-ops-report-${Date.now()}.json`;
    fs.writeFileSync(reportPath, JSON.stringify(fullReport, null, 2));
    log.success(`Full report saved to: ${reportPath}`);

    return fullReport;
  } catch (error) {
    log.error(`Pipeline failed: ${error.message}`);
    throw error;
  }
}

// Run it
runMarketingOperationsPipeline().catch((err) => {
  console.error(`${colors.red}Fatal error:${colors.reset}`, err.message);
  process.exit(1);
});
