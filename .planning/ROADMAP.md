# Roadmap: OpenCode Crawl4AI Plugin

## Overview

Build an OpenCode plugin that gives AI agents unrestricted web access. Start with plugin scaffolding and Python bridge, then add fetch and search tools, followed by SearXNG setup automation, and finally the remaining tools (extract, screenshot, crawl, map).

## Phases

**Phase Numbering:**
- Integer phases (1, 2, 3): Planned milestone work
- Decimal phases (2.1, 2.2): Urgent insertions (marked with INSERTED)

Decimal phases appear between their surrounding integers in numeric order.

- [ ] **Phase 1: Plugin Foundation** - Plugin scaffolding, TypeScript setup, Python bridge
- [ ] **Phase 2: Fetch Tool** - URL fetching with stealth mode and format options
- [ ] **Phase 3: Search Tool** - Web search with SearXNG primary, DuckDuckGo fallback
- [ ] **Phase 4: SearXNG Setup** - Docker setup automation and configuration
- [ ] **Phase 5: Additional Tools** - Extract, screenshot, crawl, map tools

## Phase Details

### Phase 1: Plugin Foundation
**Goal**: Working OpenCode plugin that can spawn Python processes and return results
**Depends on**: Nothing (first phase)
**Requirements**: CORE-01, CORE-02, CORE-03, CORE-04
**Success Criteria** (what must be TRUE):
  1. Plugin installs via npm and is recognized by OpenCode
  2. Plugin defines at least one test tool that returns a result
  3. Plugin can spawn a Python process and capture its stdout
  4. Python bridge script handles JSON input/output correctly
**Plans**: 3 plans

Plans:
- [ ] 01-01: Set up TypeScript project with @opencode-ai/plugin dependency
- [ ] 01-02: Create plugin entry point with test tool
- [ ] 01-03: Build Python bridge for spawning crawl4ai processes

### Phase 2: Fetch Tool
**Goal**: AI can fetch any URL and get clean content back
**Depends on**: Phase 1
**Requirements**: FETCH-01, FETCH-02, FETCH-03, FETCH-04, FETCH-05, FETCH-06
**Success Criteria** (what must be TRUE):
  1. AI can call `crawl4ai_fetch` with a URL and receive markdown content
  2. Fetch works on JavaScript-heavy sites (SPA support)
  3. Fetch bypasses basic bot detection (Cloudflare, etc.)
  4. AI can specify format (markdown, html, raw)
  5. AI can wait for specific elements before extracting
**Plans**: 2 plans

Plans:
- [ ] 02-01: Implement fetch tool with stealth mode and format options
- [ ] 02-02: Add JavaScript execution and selector waiting support

### Phase 3: Search Tool
**Goal**: AI can search the web and get relevant results
**Depends on**: Phase 2
**Requirements**: SRCH-01, SRCH-02, SRCH-03, SRCH-04, SRCH-05
**Success Criteria** (what must be TRUE):
  1. AI can call `crawl4ai_search` with a query and receive results
  2. Results include URL, title, and snippet for each hit
  3. SearXNG is used when available (better quality)
  4. DuckDuckGo is used as fallback (no setup required)
  5. AI can limit number of results returned
**Plans**: 2 plans

Plans:
- [ ] 03-01: Implement search tool with DuckDuckGo fallback
- [ ] 03-02: Add SearXNG backend support with auto-detection

### Phase 4: SearXNG Setup
**Goal**: Users can easily set up SearXNG for better search
**Depends on**: Phase 3
**Requirements**: SETUP-01, SETUP-02, SETUP-03, SETUP-04
**Success Criteria** (what must be TRUE):
  1. User can run setup command to check SearXNG status
  2. Setup command spawns SearXNG Docker container if not running
  3. Environment variable SEARXNG_URL allows custom instances
  4. Plugin shows clear message when SearXNG unavailable
**Plans**: 2 plans

Plans:
- [ ] 04-01: Create setup script/bin for SearXNG Docker management
- [ ] 04-02: Add configuration and environment variable support

### Phase 5: Additional Tools
**Goal**: AI has full toolkit for web interaction
**Depends on**: Phase 4
**Requirements**: XTRCT-01, XTRCT-02, XTRCT-03, SHOT-01, SHOT-02, SHOT-03, CRWL-01, CRWL-02, CRWL-03, CRWL-04, MAP-01, MAP-02, MAP-03
**Success Criteria** (what must be TRUE):
  1. AI can extract structured data using CSS selectors
  2. AI can capture page screenshots
  3. AI can deep crawl sites with BFS/DFS strategies
  4. AI can discover all URLs on a site
**Plans**: 2 plans

Plans:
- [ ] 05-01: Implement extract and screenshot tools
- [ ] 05-02: Implement crawl and map tools

## Progress

**Execution Order:**
Phases execute in numeric order: 1 → 2 → 3 → 4 → 5

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Plugin Foundation | 0/3 | Not started | - |
| 2. Fetch Tool | 0/2 | Not started | - |
| 3. Search Tool | 0/2 | Not started | - |
| 4. SearXNG Setup | 0/2 | Not started | - |
| 5. Additional Tools | 0/2 | Not started | - |
