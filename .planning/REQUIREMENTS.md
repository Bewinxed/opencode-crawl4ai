# Requirements: OpenCode Crawl4AI Plugin

**Defined:** 2025-02-19
**Core Value:** AI agents have unrestricted, reliable web access without guardrails

## v1 Requirements

### Plugin Core

- [ ] **CORE-01**: Plugin exports default async function compatible with OpenCode plugin API
- [ ] **CORE-02**: Plugin returns `tool` object with tool definitions
- [ ] **CORE-03**: Uses `@opencode-ai/plugin` for `Plugin` type and `tool` function
- [ ] **CORE-04**: Spawns Python crawl4ai processes and returns results

### Fetch Tool

- [ ] **FETCH-01**: `crawl4ai_fetch` - Fetches URL and returns content
- [ ] **FETCH-02**: Supports formats: `markdown` (default), `html`, `raw`
- [ ] **FETCH-03**: Uses stealth/undetected browser mode by default
- [ ] **FETCH-04**: Optional `js_code` parameter for JavaScript execution
- [ ] **FETCH-05**: Optional `wait_for` parameter for CSS selector waiting
- [ ] **FETCH-06**: Returns content as string for LLM processing

### Search Tool

- [ ] **SRCH-01**: `crawl4ai_search` - Searches web and returns results
- [ ] **SRCH-02**: Uses SearXNG as primary backend when available
- [ ] **SRCH-03**: Falls back to DuckDuckGo (via crawl4ai stealth mode)
- [ ] **SRCH-04**: Returns JSON with `results: [{url, title, snippet}]`
- [ ] **SRCH-05**: `limit` parameter to control result count

### SearXNG Setup

- [ ] **SETUP-01**: Plugin includes `setup` command / script
- [ ] **SETUP-02**: Setup spawns SearXNG Docker container if not running
- [ ] **SETUP-03**: Environment variable `SEARXNG_URL` for custom instances
- [ ] **SETUP-04**: Graceful fallback message when SearXNG unavailable

### Extract Tool

- [ ] **XTRCT-01**: `crawl4ai_extract` - Extracts structured data using CSS selectors
- [ ] **XTRCT-02**: Accepts `schema` parameter with CSS selector mappings
- [ ] **XTRCT-03**: Returns JSON matching the provided schema

### Screenshot Tool

- [ ] **SHOT-01**: `crawl4ai_screenshot` - Captures page screenshot
- [ ] **SHOT-02**: Returns base64 encoded image data URL
- [ ] **SHOT-03**: Optional `viewport` parameter for dimensions

### Crawl Tool

- [ ] **CRWL-01**: `crawl4ai_crawl` - Deep crawls from starting URL
- [ ] **CRWL-02**: Supports `strategy`: `bfs` (default), `dfs`, `best-first`
- [ ] **CRWL-03**: `max_depth` and `max_pages` limit parameters
- [ ] **CRWL-04**: Optional `url_pattern` for filtering URLs

### Map Tool

- [ ] **MAP-01**: `crawl4ai_map` - Discovers all URLs on a site
- [ ] **MAP-02**: Returns list of URLs with titles
- [ ] **MAP-03**: Optional `search` query to filter by relevance

## v2 Requirements

Deferred to future release.

- **LLM-01**: LLM-based extraction (using calling LLM context)
- **PRM-01**: Support for Tavily/SerpAPI search backends

## Out of Scope

| Feature | Reason |
|---------|--------|
| LLM extraction with separate API calls | Calling LLM processes content, no extra costs |
| Paid search APIs | Optional for v2 |
| Browser automation (clicking, forms) | Use opencode-browser or playwriter |
| PDF/document parsing | Not core to guardrail bypass use case |
| MCP server format | OpenCode uses native plugin API, not MCP |

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| CORE-01 | Phase 1 | Pending |
| CORE-02 | Phase 1 | Pending |
| CORE-03 | Phase 1 | Pending |
| CORE-04 | Phase 1 | Pending |
| FETCH-01 | Phase 2 | Pending |
| FETCH-02 | Phase 2 | Pending |
| FETCH-03 | Phase 2 | Pending |
| FETCH-04 | Phase 2 | Pending |
| FETCH-05 | Phase 2 | Pending |
| FETCH-06 | Phase 2 | Pending |
| SRCH-01 | Phase 3 | Pending |
| SRCH-02 | Phase 3 | Pending |
| SRCH-03 | Phase 3 | Pending |
| SRCH-04 | Phase 3 | Pending |
| SRCH-05 | Phase 3 | Pending |
| SETUP-01 | Phase 4 | Pending |
| SETUP-02 | Phase 4 | Pending |
| SETUP-03 | Phase 4 | Pending |
| SETUP-04 | Phase 4 | Pending |
| XTRCT-01 | Phase 5 | Pending |
| XTRCT-02 | Phase 5 | Pending |
| XTRCT-03 | Phase 5 | Pending |
| SHOT-01 | Phase 5 | Pending |
| SHOT-02 | Phase 5 | Pending |
| SHOT-03 | Phase 5 | Pending |
| CRWL-01 | Phase 5 | Pending |
| CRWL-02 | Phase 5 | Pending |
| CRWL-03 | Phase 5 | Pending |
| CRWL-04 | Phase 5 | Pending |
| MAP-01 | Phase 5 | Pending |
| MAP-02 | Phase 5 | Pending |
| MAP-03 | Phase 5 | Pending |

**Coverage:**
- v1 requirements: 31 total
- Mapped to phases: 31
- Unmapped: 0 ✓

---
*Requirements defined: 2025-02-19*
*Last updated: 2025-02-19 after plugin API research*
