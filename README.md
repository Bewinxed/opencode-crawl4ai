# @bewinxed/opencode-crawl4ai

OpenCode plugin for unrestricted web access. Fetch URLs, search the web, extract data - all without hitting LLM guardrails.

## Features

- **Fetch** - Retrieve any URL as markdown/HTML with stealth mode
- **Search** - Web search via SearXNG (primary) or DuckDuckGo (fallback)
- **Extract** - Structured data extraction using CSS selectors
- **Screenshot** - Capture page screenshots
- **Crawl** - Deep crawl websites with BFS/DFS strategies
- **Map** - Discover all URLs on a site

## Installation

```bash
npm install @bewinxed/opencode-crawl4ai
```

Or use with npx (no install needed):

```bash
npx @bewinxed/opencode-crawl4ai setup
```

## Setup

### Basic (DuckDuckGo search)

No setup required. The plugin will use DuckDuckGo for search, which works out of the box.

### Better Search (SearXNG)

For better search results, set up SearXNG:

```bash
# Start SearXNG Docker container
npx @bewinxed/opencode-crawl4ai setup

# Or specify a custom port
npx @bewinxed/opencode-crawl4ai setup 9000
```

This starts a SearXNG container that aggregates Google, Bing, DuckDuckGo, etc.

## Plugin Registration

### Option A: Local file (for development / self-use)

Copy or symlink `dist/plugin.js` into your project's `.opencode/plugins/` directory. OpenCode auto-discovers `*.js` files there:

```bash
# From your project root
mkdir -p .opencode/plugins
ln -s /path/to/opencode-crawl4ai/dist/plugin.js .opencode/plugins/crawl4ai.js
```

### Option B: npm package (in `opencode.json`)

Add to your project's `opencode.json` (or `~/.config/opencode/opencode.json` for global):

```json
{
  "plugin": ["@bewinxed/opencode-crawl4ai"]
}
```

## Usage in OpenCode

Once registered, the plugin provides these tools to the AI:

### `crawl4ai_fetch`

Fetch a URL and return content.

```javascript
// Basic fetch (returns markdown)
crawl4ai_fetch({ url: "https://docs.example.com" })

// Get raw HTML
crawl4ai_fetch({ url: "https://example.com", format: "html" })

// Wait for dynamic content
crawl4ai_fetch({ 
  url: "https://spa.example.com", 
  wait_for: ".content-loaded" 
})

// Execute JavaScript first
crawl4ai_fetch({ 
  url: "https://example.com",
  js_code: "document.querySelector('.show-more').click()"
})
```

### `crawl4ai_search`

Search the web.

```javascript
// Basic search
crawl4ai_search({ query: "React hooks tutorial" })

// Limit results
crawl4ai_search({ query: "Python asyncio", limit: 5 })
```

### `crawl4ai_extract`

Extract structured data.

```javascript
crawl4ai_extract({
  url: "https://example.com/product",
  schema: {
    title: "h1.product-name",
    price: ".price",
    description: ".description"
  }
})
```

### `crawl4ai_screenshot`

Take a screenshot.

```javascript
crawl4ai_screenshot({ 
  url: "https://example.com",
  width: 1920,
  height: 1080
})
```

### `crawl4ai_crawl`

Deep crawl a site.

```javascript
crawl4ai_crawl({
  url: "https://docs.example.com",
  max_pages: 20,
  max_depth: 3,
  strategy: "bfs"
})
```

### `crawl4ai_map`

Discover URLs on a site.

```javascript
crawl4ai_map({
  url: "https://example.com",
  search: "pricing",
  limit: 50
})
```

## Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `SEARXNG_URL` | URL of SearXNG instance | Uses Docker container if running |

## Requirements

- Node.js 18+
- Python 3.10+ (via uvx)
- Docker (optional, for SearXNG)

## License

MIT
