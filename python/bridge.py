#!/usr/bin/env python3
"""
Bridge between OpenCode plugin (TypeScript) and crawl4ai (Python).

Reads JSON request from stdin, executes action, writes JSON response to stdout.
Uses crawl4ai for web crawling with stealth mode by default.
"""

import asyncio
import json
import sys
import os
from typing import Any, Optional
from crawl4ai import AsyncWebCrawler, BrowserConfig, CrawlerRunConfig, CacheMode
from crawl4ai.deep_crawling import BFSDeepCrawlStrategy, DFSDeepCrawlStrategy

# SearXNG URL from environment or default
SEARXNG_URL = os.environ.get("SEARXNG_URL", "")


def log_error(msg: str) -> None:
    """Log to stderr (safe for stdin/stdout communication)."""
    print(f"[bridge error] {msg}", file=sys.stderr)


def respond(success: bool, data: Any = None, error: Optional[str] = None) -> None:
    """Write JSON response to stdout."""
    result: dict[str, Any] = {"success": success}
    if data is not None:
        result["data"] = data
    if error:
        result["error"] = error
    print(json.dumps(result))


async def debug_action() -> dict:
    """Return debug info about the bridge environment."""
    import crawl4ai

    try:
        from crawl4ai.__version__ import __version__ as crawl4ai_version
    except Exception:
        try:
            v = getattr(crawl4ai, "__version__", "unknown")
            crawl4ai_version = v.__version__ if hasattr(v, "__version__") else str(v)
        except Exception:
            crawl4ai_version = "unknown"

    return {
        "crawl4ai_version": crawl4ai_version,
        "searxng_url": SEARXNG_URL or "not configured",
        "python_version": sys.version,
    }


async def fetch_action(
    url: str,
    format: str = "markdown",
    wait_for: Optional[str] = None,
    js_code: Optional[str] = None,
    timeout: int = 30,
) -> str:
    """Fetch a URL and return content in specified format."""

    browser_config = BrowserConfig(
        headless=True,
        verbose=False,
        browser_type="chromium",
        # Enable built-in stealth mode
        enable_stealth=True,
        extra_args=[
            "--disable-blink-features=AutomationControlled",
        ],
    )

    run_config = CrawlerRunConfig(
        cache_mode=CacheMode.BYPASS,
        wait_for=wait_for,
        js_code=[js_code] if js_code else None,
        page_timeout=timeout * 1000,
        verbose=False,
    )

    async with AsyncWebCrawler(config=browser_config) as crawler:
        result = await crawler.arun(url=url, config=run_config)

        if not result.success:
            raise Exception(result.error_message or "Failed to fetch URL")

        if format == "html":
            return result.html
        elif format == "raw":
            return result.raw_html
        else:
            # Return clean markdown
            if hasattr(result.markdown, "raw_markdown"):
                return result.markdown.raw_markdown
            return str(result.markdown)


async def search_action(query: str, limit: int = 10) -> list:
    """Search the web using SearXNG (if configured) or DuckDuckGo via ddgs library."""

    results = []

    # Try SearXNG first if configured
    if SEARXNG_URL:
        try:
            import httpx

            async with httpx.AsyncClient(timeout=10) as client:
                response = await client.get(
                    f"{SEARXNG_URL.rstrip('/')}/search",
                    params={
                        "q": query,
                        "format": "json",
                    },
                )
                if response.status_code == 200:
                    data = response.json()
                    for item in data.get("results", [])[:limit]:
                        results.append(
                            {
                                "url": item.get("url", ""),
                                "title": item.get("title", ""),
                                "snippet": item.get("content", ""),
                            }
                        )
                    if results:
                        return results
        except Exception as e:
            log_error(f"SearXNG search failed: {e}")

    # Fallback: use ddgs (DuckDuckGo search library)
    try:
        # Try new package name first, fall back to old name
        try:
            from ddgs import DDGS
        except ImportError:
            from duckduckgo_search import DDGS

        with DDGS() as ddgs:
            for item in ddgs.text(query, max_results=limit):
                results.append(
                    {
                        "url": item.get("href", ""),
                        "title": item.get("title", ""),
                        "snippet": item.get("body", ""),
                    }
                )
        return results
    except Exception as e:
        log_error(f"DDG search failed: {e}")

    raise Exception(
        "All search backends failed. Configure SEARXNG_URL or ensure ddgs is available."
    )


async def extract_action(url: str, schema: dict) -> dict:
    """Extract structured data using CSS selectors."""

    from crawl4ai import JsonCssExtractionStrategy

    # Convert schema to crawl4ai format
    fields = []
    for name, selector in schema.items():
        fields.append(
            {
                "name": name,
                "selector": selector,
                "type": "text",
            }
        )

    extraction_schema = {
        "name": "extraction",
        "baseSelector": "html",
        "fields": fields,
    }

    extraction_strategy = JsonCssExtractionStrategy(extraction_schema)

    browser_config = BrowserConfig(
        headless=True,
        verbose=False,
        browser_type="chromium",
        enable_stealth=True,
        extra_args=["--disable-blink-features=AutomationControlled"],
    )

    run_config = CrawlerRunConfig(
        cache_mode=CacheMode.BYPASS,
        extraction_strategy=extraction_strategy,
        verbose=False,
    )

    async with AsyncWebCrawler(config=browser_config) as crawler:
        result = await crawler.arun(url=url, config=run_config)

        if not result.success:
            raise Exception(result.error_message or "Failed to extract")

        if result.extracted_content:
            return json.loads(result.extracted_content)
        return {}


async def screenshot_action(url: str, width: int = 1280, height: int = 720) -> str:
    """Take a screenshot and return base64 data URL."""

    # viewport_width/height are on BrowserConfig, not CrawlerRunConfig
    browser_config = BrowserConfig(
        headless=True,
        verbose=False,
        browser_type="chromium",
        viewport_width=width,
        viewport_height=height,
    )

    run_config = CrawlerRunConfig(
        cache_mode=CacheMode.BYPASS,
        screenshot=True,
        verbose=False,
    )

    async with AsyncWebCrawler(config=browser_config) as crawler:
        result = await crawler.arun(url=url, config=run_config)

        if not result.success:
            raise Exception(result.error_message or "Failed to take screenshot")

        if result.screenshot:
            return f"data:image/png;base64,{result.screenshot}"
        raise Exception("No screenshot captured")


async def crawl_action(
    url: str,
    max_pages: int = 10,
    max_depth: int = 2,
    strategy: str = "bfs",
    url_pattern: Optional[str] = None,
) -> list:
    """Deep crawl a website."""
    from crawl4ai.deep_crawling.filters import FilterChain, URLPatternFilter

    # Build filter chain if url_pattern provided
    filter_chain = None
    if url_pattern:
        filter_chain = FilterChain(filters=[URLPatternFilter(patterns=[url_pattern])])

    # Choose strategy
    if strategy == "dfs":
        crawl_strategy = DFSDeepCrawlStrategy(
            max_depth=max_depth,
            max_pages=max_pages,
            filter_chain=filter_chain,
        )
    else:
        crawl_strategy = BFSDeepCrawlStrategy(
            max_depth=max_depth,
            max_pages=max_pages,
            filter_chain=filter_chain,
        )

    browser_config = BrowserConfig(
        headless=True,
        verbose=False,
        browser_type="chromium",
        enable_stealth=True,
        extra_args=["--disable-blink-features=AutomationControlled"],
    )

    run_config = CrawlerRunConfig(
        cache_mode=CacheMode.BYPASS,
        deep_crawl_strategy=crawl_strategy,
        stream=True,
        verbose=False,
    )

    pages = []

    async with AsyncWebCrawler(config=browser_config) as crawler:
        async for result in await crawler.arun(url=url, config=run_config):
            if result.success:
                markdown = result.markdown
                if hasattr(markdown, "raw_markdown"):
                    markdown = markdown.raw_markdown
                else:
                    markdown = str(markdown)
                pages.append(
                    {
                        "url": result.url,
                        "markdown": markdown,
                    }
                )
                if len(pages) >= max_pages:
                    break

    return pages


async def map_action(url: str, search: Optional[str] = None, limit: int = 100) -> list:
    """Discover all URLs on a site."""

    browser_config = BrowserConfig(
        headless=True,
        verbose=False,
        browser_type="chromium",
    )

    # Fetch single page and collect links (faster than deep crawling for mapping)
    run_config = CrawlerRunConfig(
        cache_mode=CacheMode.BYPASS,
        verbose=False,
        deep_crawl_strategy=BFSDeepCrawlStrategy(max_depth=1, max_pages=limit),
        stream=True,
    )

    links: list[dict] = []

    async with AsyncWebCrawler(config=browser_config) as crawler:
        async for result in await crawler.arun(url=url, config=run_config):
            if result.success and hasattr(result, "links") and result.links:
                for link in result.links.get("internal", []):
                    entry = {
                        "url": link.get("href", link)
                        if isinstance(link, dict)
                        else link,
                        "title": link.get("text", "") if isinstance(link, dict) else "",
                    }
                    if entry["url"] and entry not in links:
                        links.append(entry)

    # Filter by search query if provided
    if search and links:
        search_lower = search.lower()
        links = [
            lnk
            for lnk in links
            if search_lower in lnk["url"].lower()
            or search_lower in lnk["title"].lower()
        ]

    return links[:limit]


async def main():
    """Read request from stdin, execute action, write response to stdout."""
    try:
        request_json = sys.stdin.read()
        request = json.loads(request_json)

        action = request.get("action")
        params = request.get("params", {})

        if action == "debug":
            data = await debug_action()
            respond(True, data)

        elif action == "fetch":
            data = await fetch_action(
                url=params["url"],
                format=params.get("format", "markdown"),
                wait_for=params.get("wait_for"),
                js_code=params.get("js_code"),
                timeout=params.get("timeout", 30),
            )
            respond(True, data)

        elif action == "search":
            data = await search_action(
                query=params["query"],
                limit=params.get("limit", 10),
            )
            respond(True, data)

        elif action == "extract":
            data = await extract_action(
                url=params["url"],
                schema=params["schema"],
            )
            respond(True, data)

        elif action == "screenshot":
            data = await screenshot_action(
                url=params["url"],
                width=params.get("width", 1280),
                height=params.get("height", 720),
            )
            respond(True, data)

        elif action == "crawl":
            data = await crawl_action(
                url=params["url"],
                max_pages=params.get("max_pages", 10),
                max_depth=params.get("max_depth", 2),
                strategy=params.get("strategy", "bfs"),
                url_pattern=params.get("url_pattern"),
            )
            respond(True, data)

        elif action == "map":
            data = await map_action(
                url=params["url"],
                search=params.get("search"),
                limit=params.get("limit", 100),
            )
            respond(True, data)

        else:
            respond(False, error=f"Unknown action: {action}")

    except json.JSONDecodeError as e:
        respond(False, error=f"Invalid JSON request: {e}")
    except Exception as e:
        respond(False, error=str(e))


if __name__ == "__main__":
    asyncio.run(main())
