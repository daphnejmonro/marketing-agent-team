#!/usr/bin/env node

/**
 * hosting.com Google Sheets → data.json sync
 *
 * This script reads your Search Analytics for Sheets (Search Console) data
 * and any other configured tabs, then writes data.json for the daily briefing.
 *
 * FIRST-TIME SETUP (do this once):
 *
 * 1. Go to https://console.cloud.google.com
 *    - Create a new project (or use an existing one)
 *    - Search "Google Sheets API" → Enable it
 *
 * 2. Create a Service Account:
 *    - Go to IAM & Admin → Service Accounts → Create Service Account
 *    - Name it anything (e.g. "hosting-agents")
 *    - Click the account → Keys tab → Add Key → JSON
 *    - Save the downloaded file as credentials.json in this folder
 *
 * 3. Share your Google Sheet with the service account:
 *    - Open your Google Sheet → Share
 *    - Paste the service account email (from credentials.json → "client_email")
 *    - Set permission to Viewer
 *
 * 4. Run: node sync-sheet.js
 *
 * Daily workflow:
 *   node sync-sheet.js && node daily-briefing.js
 */

const { google } = require("googleapis");
const fs   = require("fs");
const path = require("path");

const CREDENTIALS_PATH = path.join(__dirname, "credentials.json");
const CONFIG_PATH      = path.join(__dirname, "sheet-config.json");
const DATA_PATH        = path.join(__dirname, "data.json");

const colors = {
  reset: "\x1b[0m", green: "\x1b[32m", yellow: "\x1b[33m",
  red: "\x1b[31m", cyan: "\x1b[36m", dim: "\x1b[2m",
};
const ok   = msg => console.log(`  ${colors.green}✓${colors.reset} ${msg}`);
const warn = msg => console.log(`  ${colors.yellow}⚠${colors.reset} ${msg}`);
const fail = msg => console.error(`  ${colors.red}✗${colors.reset} ${msg}`);
const info = msg => console.log(`  ${colors.dim}${msg}${colors.reset}`);

// ─── Startup checks ──────────────────────────────────────────────────────────

if (!fs.existsSync(CREDENTIALS_PATH)) {
  fail("credentials.json not found.");
  console.log("\n  Follow the setup steps at the top of this file to create it.\n");
  process.exit(1);
}

const config = fs.existsSync(CONFIG_PATH)
  ? JSON.parse(fs.readFileSync(CONFIG_PATH, "utf8"))
  : {};

const SPREADSHEET_ID = config.spreadsheet_id || "1wMcBlumG0L8t_uZtWGR4ARJqhpe9SaK55-bPlKi3Ry4";

// ─── Helpers ─────────────────────────────────────────────────────────────────

function parseNum(raw) {
  if (raw === null || raw === undefined || raw === "") return null;
  const s = String(raw).trim().replace(/[%,]/g, "");
  const n = Number(s);
  return isNaN(n) ? null : n;
}

// Parse a CTR string like "3.75%" → 3.75 (as a percentage number)
function parseCtr(raw) {
  if (!raw) return null;
  const s = String(raw).trim();
  if (s.endsWith("%")) return parseFloat(s);
  const n = parseFloat(s);
  // If stored as decimal (0.0375), convert to percentage
  return n < 1 ? +(n * 100).toFixed(2) : +n.toFixed(2);
}

// Extract the date portion from a SAS tab name like "SAS_2026-05-08_12-33-30"
function sasTabDate(name) {
  const m = name.match(/SAS_(\d{4}-\d{2}-\d{2})/i);
  return m ? m[1] : null;
}

// Find the most recent SAS tab among all sheet tabs
function findLatestSasTab(sheets) {
  const sasTabs = sheets
    .filter(s => /^SAS_/i.test(s.title))
    .map(s => ({ title: s.title, date: sasTabDate(s.title) }))
    .filter(s => s.date)
    .sort((a, b) => b.date.localeCompare(a.date)); // newest first
  return sasTabs.length > 0 ? sasTabs[0] : null;
}

// Known dimension column names (anything that isn't a metric)
const METRIC_COLS = new Set(["clicks", "impressions", "ctr", "position"]);

// Parse the Search Console data grid into structured rows
function parseSearchConsoleData(rows) {
  if (!rows || rows.length < 2) return { headers: [], data: [] };

  const headers = rows[0].map(h => String(h || "").trim().toLowerCase());
  const data = [];

  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    if (!row || row.every(c => !c)) continue;

    const entry = {};
    headers.forEach((h, idx) => {
      entry[h] = row[idx] !== undefined ? String(row[idx]).trim() : "";
    });
    data.push(entry);
  }

  return { headers, data };
}

// Aggregate all rows into summary stats + optional top queries/pages
function aggregateSearchConsole(data, headers) {
  const clickCol   = headers.find(h => h.includes("click"));
  const impressCol = headers.find(h => h.includes("impression"));
  const ctrCol     = headers.find(h => h.includes("ctr"));
  const posCol     = headers.find(h => h.includes("position"));

  // A dimension column is anything that isn't a metric (query, page, country, device, etc.)
  const queryCol = headers.find(h => h.includes("query") || h.includes("keyword") || h.includes("search term"));
  const pageCol  = headers.find(h => h.includes("page") || h.includes("url") || h.includes("landing"));
  const dimCol   = queryCol || pageCol || headers.find(h => !METRIC_COLS.has(h));

  let totalClicks      = 0;
  let totalImpressions = 0;
  const ctrValues      = [];
  const posValues      = [];

  for (const row of data) {
    const clicks      = parseNum(clickCol   ? row[clickCol]   : null) || 0;
    const impressions = parseNum(impressCol ? row[impressCol] : null) || 0;
    const ctr         = parseCtr(ctrCol     ? row[ctrCol]     : null);
    const pos         = parseNum(posCol     ? row[posCol]     : null);

    totalClicks      += clicks;
    totalImpressions += impressions;
    if (ctr !== null) ctrValues.push({ value: ctr, weight: impressions });
    if (pos !== null) posValues.push({ value: pos, weight: impressions });
  }

  // Impression-weighted averages
  const ctrWeight = ctrValues.reduce((s, v) => s + v.weight, 0);
  const avgCtr = ctrWeight > 0
    ? +(ctrValues.reduce((s, v) => s + v.value * v.weight, 0) / ctrWeight).toFixed(2)
    // Fallback: if only one aggregate row, read CTR directly
    : data.length === 1 && ctrCol ? parseCtr(data[0][ctrCol]) : null;

  const posWeight = posValues.reduce((s, v) => s + v.weight, 0);
  const avgPosition = posWeight > 0
    ? +(posValues.reduce((s, v) => s + v.value * v.weight, 0) / posWeight).toFixed(1)
    : data.length === 1 && posCol ? parseNum(data[0][posCol]) : null;

  // Top 10 by clicks — only meaningful when there's a dimension column
  const hasDimension = !!dimCol;
  const dimensionType = queryCol ? "query" : pageCol ? "page" : hasDimension ? "item" : "aggregate";

  const top10 = hasDimension
    ? [...data]
        .map(row => ({
          dimension:   row[dimCol] || "(unknown)",
          clicks:      parseNum(clickCol   ? row[clickCol]   : null) || 0,
          impressions: parseNum(impressCol ? row[impressCol] : null) || 0,
          ctr:         parseCtr(ctrCol     ? row[ctrCol]     : null),
          position:    parseNum(posCol     ? row[posCol]     : null),
        }))
        .sort((a, b) => b.clicks - a.clicks)
        .slice(0, 10)
    : [];   // aggregate-only sheet: no dimension breakdown to show

  return {
    total_clicks:      totalClicks,
    total_impressions: totalImpressions,
    avg_ctr_pct:       avgCtr,
    avg_position:      avgPosition,
    dimension_type:    dimensionType,
    top_10:            top10,
    row_count:         data.length,
  };
}

// ─── Main sync ───────────────────────────────────────────────────────────────

async function sync() {
  console.log(`\n${colors.cyan}Syncing Google Sheets → data.json${colors.reset}\n`);

  const auth = new google.auth.GoogleAuth({
    keyFile: CREDENTIALS_PATH,
    scopes: ["https://www.googleapis.com/auth/spreadsheets.readonly"],
  });

  const sheets = google.sheets({ version: "v4", auth });

  // Step 1: Get spreadsheet metadata to list all tabs
  let spreadsheet;
  try {
    spreadsheet = await sheets.spreadsheets.get({ spreadsheetId: SPREADSHEET_ID });
  } catch (err) {
    if (err.code === 403) fail("Permission denied. Share the sheet with the service account email from credentials.json.");
    else if (err.code === 404) fail("Sheet not found. Check the spreadsheet_id in sheet-config.json.");
    else fail(`Google Sheets API error: ${err.message}`);
    process.exit(1);
  }

  const allTabs = spreadsheet.data.sheets.map(s => s.properties);
  info(`Found ${allTabs.length} tab(s): ${allTabs.map(t => t.title).join(", ")}`);

  // Step 2: Find the latest Search Analytics for Sheets tab
  const latestSas = findLatestSasTab(allTabs);

  // Load existing data.json as base
  const existing = fs.existsSync(DATA_PATH)
    ? JSON.parse(fs.readFileSync(DATA_PATH, "utf8"))
    : {};

  // Step 3: Read and process Search Console data
  if (latestSas) {
    info(`Using Search Console tab: ${latestSas.title} (${latestSas.date})`);

    const scResponse = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: `'${latestSas.title}'!A1:Z5000`,
    });

    const rows = scResponse.data.values || [];
    const { headers, data } = parseSearchConsoleData(rows);

    if (data.length === 0) {
      warn("Search Console tab appears to be empty.");
    } else {
      const summary = aggregateSearchConsole(data, headers);
      existing.search_console = {
        date:               latestSas.date,
        tab_name:           latestSas.title,
        ...summary,
      };

      ok(`Search Console: ${summary.total_clicks.toLocaleString()} clicks, ` +
         `${summary.total_impressions.toLocaleString()} impressions, ` +
         `${summary.avg_ctr_pct}% avg CTR, ` +
         `pos ${summary.avg_position} avg — from ${summary.row_count} ${summary.dimension_type}s`);
    }
  } else {
    // Check for any tabs that might contain search-console-style headers
    const allSasTabs = allTabs.filter(t => /^SAS_/i.test(t.title));
    if (allSasTabs.length === 0) {
      warn("No SAS_* tabs found. Make sure the Search Analytics for Sheets add-on has exported data.");
      warn(`Available tabs: ${allTabs.map(t => t.title).join(", ")}`);
    }
  }

  // Step 4: Save
  fs.writeFileSync(DATA_PATH, JSON.stringify(existing, null, 2));
  ok(`data.json updated\n`);
}

sync().catch(err => {
  fail(err.message);
  process.exit(1);
});
