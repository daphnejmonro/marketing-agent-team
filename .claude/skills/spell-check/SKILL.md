---
description: Crawl a website for spelling and grammar errors with Claude and show the flagged results. Defaults to hosting.com; pass a URL to check another site.
disable-model-invocation: true
allowed-tools: Bash(node *)
argument-hint: [url]
---

# Spell Check

Run the spell-check agent with the Bash tool, then present its flagged errors to the user as-is.

- Use a small page limit (`--max=20`) so the run is fast.
- Always pass `--url=` explicitly — without it the agent waits for keyboard input and will hang.
- If the user named a site, use that URL; otherwise default to `https://hosting.com`.

Example command:

```
node spell-check-agent.js --url=https://hosting.com --max=20
```
