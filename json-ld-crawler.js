import axios from 'axios';
import { parseStringPromise } from 'xml2js';
import { google } from 'googleapis';
import puppeteer from 'puppeteer';
import fs from 'fs';

const sheets = google.sheets('v4');
const drive = google.drive('v3');

let auth;

async function getAuth() {
  if (!auth) {
    const credentials = JSON.parse(fs.readFileSync('credentials.json', 'utf8'));
    auth = new google.auth.GoogleAuth({
      credentials,
      scopes: ['https://www.googleapis.com/auth/spreadsheets', 'https://www.googleapis.com/auth/drive'],
    });
  }
  return auth;
}

async function createSheet(title) {
  const authClient = await getAuth();

  const spreadsheet = await sheets.spreadsheets.create({
    auth: authClient,
    requestBody: {
      properties: { title },
      sheets: [{
        properties: {
          sheetId: 0,
          title: 'Malformed JSON-LD',
          gridProperties: { rowCount: 1000, columnCount: 5 }
        }
      }]
    }
  });

  const spreadsheetId = spreadsheet.data.spreadsheetId;

  // Add header row
  await sheets.spreadsheets.values.update({
    auth: authClient,
    spreadsheetId,
    range: 'Malformed JSON-LD!A1:E1',
    valueInputOption: 'RAW',
    requestBody: {
      values: [['URL', 'Issue Type', 'Snippet', 'Timestamp', 'Status']]
    }
  });

  return spreadsheetId;
}

async function appendToSheet(spreadsheetId, rows) {
  const authClient = await getAuth();

  if (rows.length === 0) return;

  await sheets.spreadsheets.values.append({
    auth: authClient,
    spreadsheetId,
    range: 'Malformed JSON-LD!A2',
    valueInputOption: 'RAW',
    requestBody: {
      values: rows
    }
  });
}

async function getSitemapUrls(sitemapIndexUrl) {
  try {
    const response = await axios.get(sitemapIndexUrl, { timeout: 10000 });
    const parsed = await parseStringPromise(response.data);

    const sitemaps = parsed.sitemapindex.sitemap.map(s => s.loc[0]);
    console.log(`Found ${sitemaps.length} sitemaps`);

    let urls = [];
    for (const sitemapUrl of sitemaps) {
      try {
        const sitemapResponse = await axios.get(sitemapUrl, { timeout: 10000 });
        const sitemapParsed = await parseStringPromise(sitemapResponse.data);
        const sitemapUrls = sitemapParsed.urlset.url.map(u => u.loc[0]);
        urls = urls.concat(sitemapUrls);
      } catch (e) {
        console.error(`Error fetching sitemap ${sitemapUrl}:`, e.message);
      }
    }

    return urls;
  } catch (e) {
    console.error('Error fetching sitemap index:', e.message);
    return [];
  }
}

function detectMalformedJsonLd(html) {
  const issues = [];

  // Look for JSON-LD blocks that contain <script> tags (escaped or raw)
  const jsonLdRegex = /<script[^>]*type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/g;
  let match;

  while ((match = jsonLdRegex.exec(html)) !== null) {
    const content = match[1];

    // Check for escaped script tags
    if (content.includes('\\u003Cscript') || content.includes('<script')) {
      issues.push({
        type: 'Escaped script tag in JSON-LD',
        snippet: content.substring(0, 200).replace(/\n/g, ' ')
      });
    }

    // Check for malformed JSON
    try {
      JSON.parse(content);
    } catch (e) {
      if (content.includes('script')) {
        issues.push({
          type: 'Invalid JSON with script reference',
          snippet: content.substring(0, 200).replace(/\n/g, ' ')
        });
      }
    }
  }

  return issues;
}

async function crawlUrl(browser, url) {
  try {
    const page = await browser.newPage();
    await page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 });
    const html = await page.content();
    await page.close();

    return html;
  } catch (e) {
    console.error(`Error crawling ${url}:`, e.message);
    return null;
  }
}

async function main() {
  console.log('Starting JSON-LD crawler...');

  // Use existing sheet
  const sheetId = '1AwHnRN7yg9j1XNEDEqjkO7YHD-kPJAmu_tGN_VgYbUw';
  console.log(`Writing to sheet: https://docs.google.com/spreadsheets/d/${sheetId}`);

  // Get URLs
  const urls = await getSitemapUrls('https://hosting.com/sitemap_index.xml');
  console.log(`Found ${urls.length} URLs to crawl`);

  // Start browser
  const browser = await puppeteer.launch({ headless: true });

  const batchSize = 50;
  let processedCount = 0;

  for (let i = 0; i < urls.length; i += batchSize) {
    const batch = urls.slice(i, i + batchSize);
    const results = [];

    for (const url of batch) {
      const html = await crawlUrl(browser, url);

      if (html) {
        const issues = detectMalformedJsonLd(html);

        if (issues.length > 0) {
          for (const issue of issues) {
            results.push([
              url,
              issue.type,
              issue.snippet,
              new Date().toISOString(),
              'Needs Review'
            ]);
          }
        }
      }

      processedCount++;
      if (processedCount % 10 === 0) {
        console.log(`Processed ${processedCount}/${urls.length}`);
      }
    }

    // Write batch to sheet
    if (results.length > 0) {
      await appendToSheet(sheetId, results);
      console.log(`Wrote ${results.length} issues to sheet`);
    }
  }

  await browser.close();

  console.log(`\n✅ Crawl complete! Results: https://docs.google.com/spreadsheets/d/${sheetId}`);
}

main().catch(console.error);
