---
description: Run the 4-agent content pipeline (opportunity → brief → E-E-A-T → full article) for a topic, then show the article. Requires a topic.
disable-model-invocation: true
allowed-tools: Bash(node *)
argument-hint: <topic>
---

# Content Brief

Run the content pipeline for the topic the user provides, then present the final article to the user as-is.

- If the user gave a topic, run it with the Bash tool.
- If no topic was provided, ask the user for one before running (the agent requires `--topic=`).

Example command:

```
node content-pipeline.js --topic="vps hosting"
```
