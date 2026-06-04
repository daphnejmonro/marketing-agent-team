#!/usr/bin/env node
require("dotenv").config();

/**
 * Spell Check Agent
 *
 * Crawls any site, extracts visible text from each page,
 * and uses Claude to find spelling mistakes with full context.
 *
 * SETUP (run once after Node 18 is installed):
 *   cd ~/Claude/files && npm install axios cheerio
 *
 * USAGE:
 *   node spell-check-agent.js                        # prompts for target URL
 *   node spell-check-agent.js --url https://other.com # scans any site
 *   node spell-check-agent.js --max 50               # crawl up to 50 pages (default: 20)
 *   node spell-check-agent.js --save                 # also saves report as JSON
 */

if (typeof File === "undefined") { global.File = require("buffer").File; }

const Anthropic = require("@anthropic-ai/sdk");
const axios     = require("axios");
const cheerio   = require("cheerio");
const fs        = require("fs");
const path      = require("path");

const client = new Anthropic.default();

// ── Config ────────────────────────────────────────────────────────────────────
const args        = process.argv.slice(2);
const urlArg      = args.find(a => a.startsWith("--url="));
const maxArg      = args.find(a => a.startsWith("--max="));
const sheetIdArg  = args.find(a => a.startsWith("--sheet-id="));
const saveReport  = args.includes("--save");
const exportSheet = args.includes("--sheet") || !!sheetIdArg;

const MAX_PAGES   = maxArg ? parseInt(maxArg.split("=")[1]) : 500;

let START_URL, BASE_HOST, BASE_ORIGIN;

async function resolveStartUrl() {
  if (urlArg) return urlArg.split("=")[1];
  const readline = require("readline");
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise(resolve => {
    rl.question("  Which site would you like to spell-check? Enter a URL: ", answer => {
      rl.close();
      const url = answer.trim() || "https://hosting.com";
      resolve(url.startsWith("http") ? url : `https://${url}`);
    });
  });
}

const SHEET_ID    = sheetIdArg ? sheetIdArg.split("=")[1] : null;

// ── Colors ────────────────────────────────────────────────────────────────────
const c = {
  reset:   "\x1b[0m",  bright:  "\x1b[1m",  dim:    "\x1b[2m",
  red:     "\x1b[31m", green:   "\x1b[32m",  yellow: "\x1b[33m",
  cyan:    "\x1b[36m", magenta: "\x1b[35m",
};
const ok   = t => console.log(`  ${c.green}✓${c.reset} ${t}`);
const warn = t => console.log(`  ${c.yellow}⚠${c.reset} ${t}`);
const err  = t => console.log(`  ${c.red}✗${c.reset} ${t}`);
const info = t => console.log(`  ${c.dim}${t}${c.reset}`);

// ── Crawl helpers ─────────────────────────────────────────────────────────────

// Tags whose text content we skip (navigation, scripts, etc.)
const SKIP_TAGS = new Set([
  "script", "style", "noscript", "svg", "head", "meta", "link",
  "nav", "header", "footer", "aside",
]);

function extractText($) {
  const chunks = [];
  $("body").find("*").each((_, el) => {
    const tag = el.tagName ? el.tagName.toLowerCase() : "";
    if (SKIP_TAGS.has(tag)) return;
    const text = $(el).clone().children().remove().end().text().trim();
    if (text.length > 15) chunks.push(text);  // ignore tiny fragments
  });
  // Deduplicate consecutive duplicates and join
  const unique = chunks.filter((t, i) => t !== chunks[i - 1]);
  return unique.join("\n").replace(/\n{3,}/g, "\n\n").trim();
}

function extractLinks($, pageUrl) {
  const links = new Set();
  $("a[href]").each((_, el) => {
    try {
      const href = $(el).attr("href");
      const abs  = new URL(href, pageUrl).href;
      const u    = new URL(abs);
      // Internal links only; strip hash and query to avoid duplicates
      if (u.hostname === BASE_HOST) {
        // Force HTTPS to avoid failover redirect infrastructure
        if (u.protocol === "http:") u.protocol = "https:";
        links.add(`${u.origin}${u.pathname}`);
      }
    } catch {
      // ignore bad hrefs
    }
  });
  return [...links];
}

async function fetchPage(url) {
  const res = await axios.get(url, {
    timeout: 10000,
    headers: { "User-Agent": "Mozilla/5.0 (compatible; SpellCheckBot/1.0)" },
    maxRedirects: 5,
  });
  return res.data;
}

// ── Sitemap discovery ─────────────────────────────────────────────────────────

// Parse all <loc> URLs out of a sitemap or sitemap index XML string
function parseLocsFromXml(xml) {
  const locs = [];
  const re = /<loc>(.*?)<\/loc>/g;
  let m;
  while ((m = re.exec(xml)) !== null) {
    locs.push(m[1].trim());
  }
  return locs;
}

// Fetch one sitemap URL (handles both sitemap index and regular sitemaps)
async function fetchSitemapUrls(sitemapUrl, visited = new Set()) {
  if (visited.has(sitemapUrl)) return [];
  visited.add(sitemapUrl);

  let xml;
  try {
    const res = await axios.get(sitemapUrl, {
      timeout: 10000,
      headers: { "User-Agent": "Mozilla/5.0 (compatible; SpellCheckBot/1.0)" },
      maxRedirects: 5,
    });
    xml = res.data;
  } catch {
    return [];
  }

  const locs = parseLocsFromXml(xml);
  const isIndex = xml.includes("<sitemapindex");

  if (isIndex) {
    // Recurse into each child sitemap
    const all = [];
    for (const loc of locs) {
      const child = await fetchSitemapUrls(loc, visited);
      all.push(...child);
    }
    return all;
  }

  // Regular sitemap — return only URLs that belong to this host
  return locs.filter(u => {
    try { return new URL(u).hostname === BASE_HOST; } catch { return false; }
  });
}

// Try common sitemap locations and return all discovered page URLs
async function discoverUrlsViaSitemap() {
  const candidates = [
    `${BASE_ORIGIN}/sitemap.xml`,
    `${BASE_ORIGIN}/sitemap_index.xml`,
    `${BASE_ORIGIN}/sitemap-index.xml`,
    `${BASE_ORIGIN}/sitemaps/sitemap.xml`,
  ];

  for (const candidate of candidates) {
    const urls = await fetchSitemapUrls(candidate);
    if (urls.length > 0) {
      ok(`Sitemap found at ${candidate} — ${urls.length} URLs discovered`);
      return urls;
    }
  }

  warn("No sitemap found — falling back to link crawling");
  return [];
}

// ── Spell check via Claude ────────────────────────────────────────────────────

async function spellCheckPage(url, text) {
  const systemPrompt = `You are a professional copy editor performing a spell check audit.

Your job is to find ONLY genuine spelling mistakes in the text provided.

Rules:
- Only report clear misspellings (wrong letters, transposed letters, missing letters)
- Do NOT report: grammar issues, style choices, brand names, proper nouns, technical terms, domain names, URLs, email addresses, acronyms, or intentional informal language
- If there are no spelling errors, respond with exactly: NO_ERRORS
- For each error found, output one line in this exact format:
  MISSPELLING: "wrongword" → "correctword" | Context: "...surrounding text..."
- Keep context to ~8 words around the misspelling
- Be conservative — if unsure whether something is a misspelling or a brand/proper noun, skip it`;

  const userPrompt = `Check this text from ${url} for spelling mistakes:\n\n${text.slice(0, 6000)}`;

  const response = await client.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 800,
    system: systemPrompt,
    messages: [{ role: "user", content: userPrompt }],
  });

  return response.content[0].type === "text" ? response.content[0].text.trim() : "";
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function run() {
  START_URL  = await resolveStartUrl();
  BASE_HOST   = new URL(START_URL).hostname;
  BASE_ORIGIN = new URL(START_URL).origin;

  console.log(`\n${c.bright}${c.cyan}Spell Check Agent — ${BASE_HOST}${c.reset}`);
  console.log(`${c.dim}Max pages: ${MAX_PAGES}${c.reset}\n`);

  const visited = new Set();
  const results = [];
  let   crawled = 0;

  // ── Seed queue from sitemap first, fall back to start URL ──
  info("Checking sitemap...");
  const sitemapUrls = await discoverUrlsViaSitemap();
  const queue = sitemapUrls.length > 0 ? sitemapUrls : [START_URL];
  console.log(`${c.dim}  ${queue.length} URLs queued for checking${c.reset}\n`);

  // ── Crawl phase ──
  while (queue.length > 0 && crawled < MAX_PAGES) {
    const url = queue.shift();
    if (visited.has(url)) continue;
    visited.add(url);
    crawled++;

    const total = Math.min(queue.length + crawled, MAX_PAGES);
    process.stdout.write(`  ${c.dim}[${crawled}/${total}] Fetching ${url}...${c.reset}`);

    let html;
    try {
      html = await fetchPage(url);
      process.stdout.write(` ${c.green}ok${c.reset}\n`);
    } catch (e) {
      process.stdout.write(` ${c.red}failed (${e.message})${c.reset}\n`);
      continue;
    }

    const $     = cheerio.load(html);
    const text  = extractText($);
    const links = extractLinks($, url);

    // Add unvisited internal links to queue
    for (const link of links) {
      if (!visited.has(link) && !queue.includes(link)) queue.push(link);
    }

    if (text.length < 50) {
      info(`  Skipping — not enough text content`);
      continue;
    }

    // ── Spell check this page ──
    let rawResult;
    try {
      rawResult = await spellCheckPage(url, text);
    } catch (e) {
      err(`Spell check failed for ${url}: ${e.message}`);
      continue;
    }

    if (rawResult === "NO_ERRORS") {
      ok(`No errors — ${url}`);
      results.push({ url, errors: [] });
    } else {
      // Parse the MISSPELLING lines
      const errors = rawResult
        .split("\n")
        .filter(l => l.startsWith("MISSPELLING:"))
        .map(l => {
          const m = l.match(/MISSPELLING:\s*"([^"]+)"\s*→\s*"([^"]+)"\s*\|\s*Context:\s*"([^"]+)"/);
          return m ? { wrong: m[1], correct: m[2], context: m[3] } : null;
        })
        .filter(Boolean);

      if (errors.length > 0) {
        warn(`${errors.length} error${errors.length > 1 ? "s" : ""} — ${url}`);
        errors.forEach(e => {
          console.log(`      ${c.red}"${e.wrong}"${c.reset} → ${c.green}"${e.correct}"${c.reset}`);
          console.log(`      ${c.dim}Context: "...${e.context}..."${c.reset}`);
        });
        results.push({ url, errors });
      } else {
        ok(`No errors — ${url}`);
        results.push({ url, errors: [] });
      }
    }

    // Small delay to be polite to the server
    await new Promise(r => setTimeout(r, 500));
  }

  // ── Summary ──
  const pagesWithErrors = results.filter(r => r.errors.length > 0);
  const totalErrors     = results.reduce((s, r) => s + r.errors.length, 0);

  console.log(`\n${c.bright}${"─".repeat(60)}${c.reset}`);
  console.log(`${c.bright}Summary${c.reset}`);
  console.log(`  Pages crawled:      ${crawled}`);
  console.log(`  Pages with errors:  ${pagesWithErrors.length}`);
  console.log(`  Total misspellings: ${totalErrors}`);

  if (totalErrors === 0) {
    console.log(`\n  ${c.green}${c.bright}✓ No spelling errors found!${c.reset}\n`);
  } else {
    console.log(`\n  ${c.yellow}Pages to fix:${c.reset}`);
    pagesWithErrors.forEach(r => {
      console.log(`    ${c.red}•${c.reset} ${r.url} (${r.errors.length} error${r.errors.length > 1 ? "s" : ""})`);
    });
    console.log();
  }

  // ── Always export CSV when errors found ──
  if (totalErrors > 0) {
    const csvPath = path.join(__dirname, `spell-check-${BASE_HOST}-${new Date().toISOString().slice(0,10)}.csv`);
    const rows = [["Page URL", "Misspelling", "Correction", "Context"]];
    for (const r of results) {
      for (const e of r.errors) {
        rows.push([r.url, e.wrong, e.correct, e.context]);
      }
    }
    const csv = rows.map(r => r.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(",")).join("\n");
    fs.writeFileSync(csvPath, csv);
    ok(`CSV saved: ${path.basename(csvPath)}`);
  }

  // ── Export to Google Sheets ──
  if (exportSheet && totalErrors > 0) {
    await exportToGoogleSheets(results, BASE_HOST);
  } else if (exportSheet && totalErrors === 0) {
    info("No errors to export to Google Sheets.");
  }

  // ── Save JSON report ──
  if (saveReport || totalErrors > 0) {
    const reportPath = path.join(__dirname, `spell-check-report-${Date.now()}.json`);
    const report = {
      timestamp:     new Date().toISOString(),
      site:          BASE_HOST,
      pages_crawled: crawled,
      total_errors:  totalErrors,
      results:       results.filter(r => r.errors.length > 0),
    };
    fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
    ok(`JSON report saved: ${path.basename(reportPath)}\n`);
  }
}

// ── Google Sheets export ──────────────────────────────────────────────────────

async function exportToGoogleSheets(results, site) {
  if (!SHEET_ID) {
    err("No Sheet ID provided. Use --sheet-id=YOUR_GOOGLE_SHEET_ID to export.");
    err("Example: node spell-check-agent.js --sheet --sheet-id=1abc123...");
    return;
  }

  const CREDENTIALS_PATH = path.join(__dirname, "credentials.json");
  if (!fs.existsSync(CREDENTIALS_PATH)) {
    warn("Skipping Google Sheets export — credentials.json not found.");
    warn("Follow the Google setup steps in Agent-Setup-Security-Guide.docx to enable this.");
    return;
  }

  const { google } = require("googleapis");
  const auth = new google.auth.GoogleAuth({
    keyFile: CREDENTIALS_PATH,
    scopes: ["https://www.googleapis.com/auth/spreadsheets"],
  });
  const sheets = google.sheets({ version: "v4", auth });

  const tabName  = `SpellCheck-${site}-${new Date().toISOString().slice(0,10)}`;
  const header   = [["Page URL", "Misspelling", "Correction", "Context", "Status"]];
  const dataRows = [];

  for (const r of results) {
    for (const e of r.errors) {
      dataRows.push([r.url, e.wrong, e.correct, e.context, "To Fix"]);
    }
  }

  if (dataRows.length === 0) return;

  try {
    // Add a new tab
    await sheets.spreadsheets.batchUpdate({
      spreadsheetId: SHEET_ID,
      requestBody: {
        requests: [{ addSheet: { properties: { title: tabName } } }],
      },
    });

    // Write header + data
    await sheets.spreadsheets.values.update({
      spreadsheetId: SHEET_ID,
      range: `'${tabName}'!A1`,
      valueInputOption: "RAW",
      requestBody: { values: [...header, ...dataRows] },
    });

    // Bold the header row
    const sheetMeta = await sheets.spreadsheets.get({ spreadsheetId: SHEET_ID });
    const sheetObj  = sheetMeta.data.sheets.find(s => s.properties.title === tabName);
    if (sheetObj) {
      await sheets.spreadsheets.batchUpdate({
        spreadsheetId: SHEET_ID,
        requestBody: {
          requests: [{
            repeatCell: {
              range: { sheetId: sheetObj.properties.sheetId, startRowIndex: 0, endRowIndex: 1 },
              cell: { userEnteredFormat: { textFormat: { bold: true } } },
              fields: "userEnteredFormat.textFormat.bold",
            },
          }],
        },
      });
    }

    ok(`Exported to Google Sheets — tab: "${tabName}"`);
    info(`Open: https://docs.google.com/spreadsheets/d/${SHEET_ID}`);
  } catch (e) {
    if (e.code === 403) {
      warn("Google Sheets export failed — service account needs Editor access to the sheet (currently Viewer).");
      warn("Go to Google Sheets → Share → change service account permission to Editor.");
    } else {
      warn(`Google Sheets export failed: ${e.message}`);
    }
  }
}

run().catch(e => {
  err(`Fatal: ${e.message}`);
  process.exit(1);
});
