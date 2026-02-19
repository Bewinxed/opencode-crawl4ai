# OpenCode Crawl4AI Plugin

## What This Is

An OpenCode plugin that gives AI agents unrestricted web access through crawling and search capabilities. Uses crawl4ai (Python) as the underlying engine to fetch, scrape, and extract web content without hitting LLM guardrails. The AI can research topics, fetch documentation, and access any web resource directly.

## Core Value

**AI agents have unrestricted, reliable web access without guardrails.**

If everything else fails, this must work: an agent can fetch any URL and search the web for information.

## Requirements

### Validated

(None yet — ship to validate)

### Active

- [ ] Plugin exports OpenCode-compatible tools using `@opencode-ai/plugin`
- [ ] Fetch tool that retrieves any URL as markdown/HTML
- [ ] Search tool (SearXNG primary, DuckDuckGo fallback)
- [ ] Stealth mode by default (bypasses bot detection)
- [ ] Extract, screenshot, crawl, and map tools

### Out of Scope

- LLM-based extraction (separate API calls) — the calling LLM processes returned content
- Paid search APIs (Tavily, SerpAPI) — optional later
- Browser automation beyond fetching (clicking, form filling) — use opencode-browser or playwriter
- MCP server format — OpenCode uses native plugin API

## Context

**OpenCode Plugin API:**
- TypeScript modules using `@opencode-ai/plugin` package
- Export default async function: `(ctx) => { return { tool: {...} } }`
- Tools defined with `tool({ description, args: { param: schema.type() }, execute })`
- Can spawn child processes for native code integration

**crawl4ai** (Python):
- Open-source web crawler (60k+ GitHub stars)
- Converts pages to LLM-ready Markdown
- Handles JavaScript rendering, dynamic content
- Supports stealth mode (undetected browser)
- Has Python API and CLI

**SearXNG** (Search):
- Self-hosted metasearch engine
- Aggregates Google, Bing, DuckDuckGo, etc.
- Runs as Docker container: `docker run -d -p 8888:8080 searxng/searxng`
- Returns JSON results, no rate limits when self-hosted

**DuckDuckGo Fallback:**
- Crawl DDG HTML results with stealth mode
- Works out of box, no setup required

## Constraints

- **Tech Stack**: TypeScript plugin, Python bridge (spawn crawl4ai), Docker for SearXNG
- **Plugin API**: Must use `@opencode-ai/plugin` types and `tool()` function
- **Process Communication**: Plugin spawns Python, captures stdout as result
- **Stealth**: Must use undetected browser mode by default

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| SearXNG primary, DDG fallback | Best search quality without API keys, graceful degradation | — Pending |
| TypeScript plugin spawning Python | crawl4ai is Python-native, OpenCode plugins are TypeScript | — Pending |
| No LLM extraction calls | Calling LLM processes content, avoids extra API costs | — Pending |
| Stealth mode by default | Users expect bypass of bot detection | — Pending |

---
*Last updated: 2025-02-19 after OpenCode plugin API research*
