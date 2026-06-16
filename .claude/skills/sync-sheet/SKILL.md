---
description: Pull live Search Console data from Google Sheets into data.json. Requires Google credentials (GOOGLE_CREDENTIALS in .env) — not needed for the daily-briefing demo.
disable-model-invocation: true
allowed-tools: Bash(node *)
---

# Sync Sheet

Run the Google Sheets sync and present the output below to the user as-is.
If it reports that `credentials.json` is missing, tell the user this agent needs the
Google setup (SETUP·04 in the deck) and point them at `GOOGLE_CREDENTIALS` in `.env`.

!`node sync-sheet.js`
