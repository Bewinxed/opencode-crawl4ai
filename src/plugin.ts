import type { Plugin } from "@opencode-ai/plugin";
import { tool } from "@opencode-ai/plugin";
import { spawn } from "child_process";
import { readFile } from "fs/promises";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const PACKAGE_JSON_PATH = join(__dirname, "..", "package.json");
const PYTHON_BRIDGE_PATH = join(__dirname, "..", "python", "bridge.py");

let cachedVersion: string | null = null;

async function getPackageVersion(): Promise<string> {
  if (cachedVersion) return cachedVersion;
  try {
    const pkg = JSON.parse(await readFile(PACKAGE_JSON_PATH, "utf8"));
    if (typeof pkg?.version === "string") {
      cachedVersion = pkg.version;
      return cachedVersion;
    }
  } catch {
    // ignore
  }
  cachedVersion = "unknown";
  return cachedVersion;
}

interface BridgeRequest {
  action: string;
  params: Record<string, unknown>;
}

interface BridgeResponse {
  success: boolean;
  data?: unknown;
  error?: string;
}

/**
 * Execute the Python bridge — uses system python3 if crawl4ai is installed,
 * otherwise falls back to uvx with crawl4ai bundled.
 */
async function executeBridge(request: BridgeRequest): Promise<BridgeResponse> {
  return new Promise((resolve) => {
    const requestJson = JSON.stringify(request);

    // Auto-detect: use system python3 if crawl4ai is already installed, else uvx
    let useSystem = false;
    try {
      const { execSync: execS } = require("child_process") as typeof import("child_process");
      execS('python3 -c "import crawl4ai"', { stdio: "pipe" });
      useSystem = true;
    } catch { /* fall through to uvx */ }

    const cmd = useSystem ? "python3" : "uvx";
    const args = useSystem
      ? [PYTHON_BRIDGE_PATH]
      : ["--with", "crawl4ai", "--with", "ddgs", "--with", "beautifulsoup4", "python", PYTHON_BRIDGE_PATH];

    const proc = spawn(cmd, args, {
      stdio: ["pipe", "pipe", "pipe"],
    });

    let stdout = "";
    let stderr = "";

    proc.stdout.on("data", (data) => {
      stdout += data.toString();
    });

    proc.stderr.on("data", (data) => {
      stderr += data.toString();
    });

    proc.on("close", (code) => {
      if (code !== 0) {
        resolve({
          success: false,
          error: stderr || `Process exited with code ${code}`,
        });
        return;
      }

      try {
        // Try to parse the last line as JSON (bridge outputs result on last line)
        const lines = stdout.trim().split("\n");
        const lastLine = lines[lines.length - 1];
        const result = JSON.parse(lastLine);
        resolve(result);
      } catch {
        resolve({
          success: false,
          error: `Failed to parse bridge output: ${stdout.slice(0, 500)}`,
        });
      }
    });

    proc.on("error", (err) => {
      resolve({
        success: false,
        error: `Failed to spawn bridge: ${err.message}`,
      });
    });

    // Send the request to stdin
    proc.stdin.write(requestJson);
    proc.stdin.end();
  });
}

const { schema } = tool;

const plugin: Plugin = async (ctx) => {
  return {
    tool: {
      crawl4ai_version: tool({
        description: "Get the installed opencode-crawl4ai plugin version.",
        args: {},
        async execute() {
          const version = await getPackageVersion();
          return JSON.stringify({
            name: "@bewinxed/opencode-crawl4ai",
            version,
            timestamp: new Date().toISOString(),
          });
        },
      }),

      crawl4ai_debug: tool({
        description: "Debug the plugin and bridge connection.",
        args: {},
        async execute() {
          const version = await getPackageVersion();
          const result = await executeBridge({
            action: "debug",
            params: {},
          });
          return JSON.stringify({
            pluginVersion: version,
            bridgeResult: result,
            timestamp: new Date().toISOString(),
          });
        },
      }),

      crawl4ai_fetch: tool({
        description: `Fetch a URL and return its content.

By default, returns clean markdown. Use format='html' for raw HTML or format='raw' for unprocessed content.
Uses stealth mode by default to bypass bot detection.

Examples:
- Fetch a documentation page: crawl4ai_fetch({ url: "https://docs.example.com" })
- Get raw HTML: crawl4ai_fetch({ url: "https://example.com", format: "html" })
- Wait for dynamic content: crawl4ai_fetch({ url: "https://spa.example.com", wait_for: ".content-loaded" })`,
        args: {
          url: schema.string().describe("The URL to fetch"),
          format: schema.string().optional().describe("Output format: 'markdown' (default), 'html', or 'raw'"),
          wait_for: schema.string().optional().describe("CSS selector to wait for before extracting content"),
          js_code: schema.string().optional().describe("JavaScript code to execute before extraction"),
          timeout: schema.number().optional().describe("Timeout in seconds (default: 30)"),
        },
        async execute({ url, format, wait_for, js_code, timeout }) {
          const result = await executeBridge({
            action: "fetch",
            params: {
              url,
              format: format || "markdown",
              wait_for,
              js_code,
              timeout: timeout || 30,
            },
          });

          if (!result.success) {
            return `Error fetching ${url}: ${result.error}`;
          }

          // Return the content directly as string for LLM processing
          if (typeof result.data === "string") {
            return result.data;
          }
          return JSON.stringify(result.data, null, 2);
        },
      }),

      crawl4ai_search: tool({
        description: `Search the web and return results.

Uses SearXNG as primary backend (when available via SEARXNG_URL env var), falls back to DuckDuckGo.
Returns a list of results with URL, title, and snippet.

Examples:
- Search for documentation: crawl4ai_search({ query: "React hooks tutorial" })
- Limit results: crawl4ai_search({ query: "Python asyncio", limit: 5 })`,
        args: {
          query: schema.string().describe("The search query"),
          limit: schema.number().optional().describe("Maximum number of results (default: 10)"),
        },
        async execute({ query, limit }) {
          const result = await executeBridge({
            action: "search",
            params: {
              query,
              limit: limit || 10,
            },
          });

          if (!result.success) {
            return `Error searching for "${query}": ${result.error}`;
          }

          const results = result.data as Array<{ url: string; title: string; snippet: string }>;
          
          // Format results for LLM readability
          if (!results || results.length === 0) {
            return `No results found for "${query}"`;
          }

          return results.map((r, i) => 
            `${i + 1}. **${r.title}**\n   ${r.url}\n   ${r.snippet}`
          ).join("\n\n");
        },
      }),

      crawl4ai_extract: tool({
        description: `Extract structured data from a URL using CSS selectors.

Provide a schema object mapping field names to CSS selectors.
Returns JSON with the extracted data.

Examples:
- Extract product info: crawl4ai_extract({ url: "...", schema: { title: "h1.product-name", price: ".price" } })`,
        args: {
          url: schema.string().describe("The URL to extract from"),
          schema: schema.record(schema.string(), schema.string()).describe("Object mapping field names to CSS selectors"),
        },
        async execute({ url, schema }) {
          const result = await executeBridge({
            action: "extract",
            params: { url, schema },
          });

          if (!result.success) {
            return `Error extracting from ${url}: ${result.error}`;
          }

          return JSON.stringify(result.data, null, 2);
        },
      }),

      crawl4ai_screenshot: tool({
        description: `Take a screenshot of a web page.

Returns base64-encoded image data URL that can be displayed or processed.

Examples:
- Take screenshot: crawl4ai_screenshot({ url: "https://example.com" })
- Custom viewport: crawl4ai_screenshot({ url: "...", width: 1920, height: 1080 })`,
        args: {
          url: schema.string().describe("The URL to screenshot"),
          width: schema.number().optional().describe("Viewport width (default: 1280)"),
          height: schema.number().optional().describe("Viewport height (default: 720)"),
        },
        async execute({ url, width, height }) {
          const result = await executeBridge({
            action: "screenshot",
            params: { url, width: width || 1280, height: height || 720 },
          });

          if (!result.success) {
            return `Error taking screenshot of ${url}: ${result.error}`;
          }

          // Return the data URL directly
          return result.data as string;
        },
      }),

      crawl4ai_crawl: tool({
        description: `Deep crawl a website starting from a URL.

Crawls multiple pages following links, up to max_pages and max_depth limits.
Returns content from all crawled pages.

Examples:
- Crawl docs: crawl4ai_crawl({ url: "https://docs.example.com", max_pages: 20 })
- BFS strategy: crawl4ai_crawl({ url: "...", strategy: "bfs", max_depth: 2 })`,
        args: {
          url: schema.string().describe("Starting URL to crawl"),
          max_pages: schema.number().optional().describe("Maximum pages to crawl (default: 10)"),
          max_depth: schema.number().optional().describe("Maximum depth from start URL (default: 2)"),
          strategy: schema.string().optional().describe("Crawl strategy: 'bfs' (default) or 'dfs'"),
          url_pattern: schema.string().optional().describe("Regex pattern to filter URLs"),
        },
        async execute({ url, max_pages, max_depth, strategy, url_pattern }) {
          const result = await executeBridge({
            action: "crawl",
            params: {
              url,
              max_pages: max_pages || 10,
              max_depth: max_depth || 2,
              strategy: strategy || "bfs",
              url_pattern,
            },
          });

          if (!result.success) {
            return `Error crawling ${url}: ${result.error}`;
          }

          const pages = result.data as Array<{ url: string; markdown: string }>;
          
          // Format for LLM readability
          return pages.map((p, i) => 
            `---\n## Page ${i + 1}: ${p.url}\n\n${p.markdown.slice(0, 5000)}${p.markdown.length > 5000 ? "\n\n... (truncated)" : ""}`
          ).join("\n\n");
        },
      }),

      crawl4ai_map: tool({
        description: `Discover all URLs on a website.

Returns a list of URLs with their titles. Useful for site exploration.

Examples:
- Map a site: crawl4ai_map({ url: "https://example.com" })
- Filter by search: crawl4ai_map({ url: "...", search: "pricing" })`,
        args: {
          url: schema.string().describe("The URL to map"),
          search: schema.string().optional().describe("Optional search query to filter URLs by relevance"),
          limit: schema.number().optional().describe("Maximum URLs to return (default: 100)"),
        },
        async execute({ url, search, limit }) {
          const result = await executeBridge({
            action: "map",
            params: { url, search, limit: limit || 100 },
          });

          if (!result.success) {
            return `Error mapping ${url}: ${result.error}`;
          }

          const links = result.data as Array<{ url: string; title: string }>;
          
          return links.map((l, i) => `${i + 1}. [${l.title}](${l.url})`).join("\n");
        },
      }),
    },
  };
};

export default plugin;
