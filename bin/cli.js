#!/usr/bin/env node

import { existsSync } from "node:fs";
import { copyFile, mkdir, readFile, unlink } from "node:fs/promises";
import { execSync } from "node:child_process";
import { homedir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const pluginsDir = join(homedir(), ".config", "opencode", "plugins");
const pluginSource = join(__dirname, "..", "dist", "plugin.js");
const pluginTarget = join(pluginsDir, "crawl4ai.js");
const packageJson = join(__dirname, "..", "package.json");

const SEARXNG_CONTAINER = "opencode-crawl4ai-searxng";
const SEARXNG_DEFAULT_PORT = 8888;

async function getVersion() {
  const pkg = JSON.parse(await readFile(packageJson, "utf-8"));
  return pkg.version;
}

async function install() {
  const version = await getVersion();
  console.log(`Installing opencode-crawl4ai v${version}...\n`);

  if (!existsSync(pluginSource)) {
    console.error(`Error: Built plugin not found at ${pluginSource}`);
    console.error("This shouldn't happen with a published package. Try reinstalling.");
    process.exit(1);
  }

  await mkdir(pluginsDir, { recursive: true });
  await copyFile(pluginSource, pluginTarget);
  console.log(`✓ Plugin installed to: ${pluginTarget}`);
  console.log("\nInstallation complete! Restart OpenCode to activate the plugin.");
  console.log("\nAvailable tools: crawl4ai_fetch, crawl4ai_search, crawl4ai_extract,");
  console.log("                 crawl4ai_screenshot, crawl4ai_crawl, crawl4ai_map");
  console.log("\nOptional: run 'opencode-crawl4ai searxng' to set up faster search.");
}

async function uninstall() {
  console.log("Uninstalling opencode-crawl4ai...\n");

  if (!existsSync(pluginTarget)) {
    console.log("Plugin not found at", pluginTarget);
    console.log("Nothing to uninstall.");
    return;
  }

  await unlink(pluginTarget);
  console.log(`✓ Removed: ${pluginTarget}`);
  console.log("\nUninstall complete! Restart OpenCode to deactivate.");
  console.log("To fully remove: npm uninstall -g opencode-crawl4ai");
}

function isDockerRunning() {
  try {
    execSync("docker info", { stdio: "pipe" });
    return true;
  } catch {
    return false;
  }
}

function isSearXNGRunning() {
  try {
    const result = execSync(
      `docker ps --filter name=${SEARXNG_CONTAINER} --format {{.Names}}`,
      { stdio: ["pipe", "pipe", "pipe"] }
    ).toString().trim();
    return result === SEARXNG_CONTAINER;
  } catch {
    return false;
  }
}

function startSearXNG(port) {
  if (!isDockerRunning()) {
    console.error("Error: Docker is not running. Please start Docker first.");
    process.exit(1);
  }

  console.log(`Starting SearXNG on port ${port}...`);
  try {
    execSync(`docker rm -f ${SEARXNG_CONTAINER} 2>/dev/null || true`, { stdio: "pipe" });
    execSync(
      `docker run -d --name ${SEARXNG_CONTAINER} -p ${port}:8080 --restart unless-stopped searxng/searxng:latest`,
      { stdio: "inherit" }
    );
    console.log(`\n✓ SearXNG started at http://localhost:${port}`);
    console.log(`\nSet this env var for the plugin to use it:`);
    console.log(`  export SEARXNG_URL=http://localhost:${port}`);
  } catch (err) {
    console.error(`Failed to start SearXNG: ${err.message}`);
    process.exit(1);
  }
}

function stopSearXNG() {
  console.log("Stopping SearXNG...");
  try {
    execSync(`docker stop ${SEARXNG_CONTAINER}`, { stdio: "pipe" });
    execSync(`docker rm ${SEARXNG_CONTAINER}`, { stdio: "pipe" });
    console.log("✓ SearXNG stopped.");
  } catch {
    console.log("SearXNG container not found or already stopped.");
  }
}

function showStatus() {
  const running = isSearXNGRunning();
  console.log("\n=== opencode-crawl4ai status ===\n");
  console.log(`Plugin:   ${existsSync(pluginTarget) ? "✓ installed" : "✗ not installed"} (${pluginTarget})`);
  console.log(`SearXNG:  ${running ? "✓ running" : "✗ not running"}`);
  if (running) {
    const searxngUrl = process.env.SEARXNG_URL || `http://localhost:${SEARXNG_DEFAULT_PORT}`;
    console.log(`  URL: ${searxngUrl}`);
  }
  console.log("");
}

async function showHelp() {
  const version = await getVersion();
  console.log(`opencode-crawl4ai v${version}

Usage: opencode-crawl4ai [command] [options]

Commands:
  (no args)       Install plugin (same as --install)
  --install       Copy plugin to ~/.config/opencode/plugins/ (auto-loaded by OpenCode)
  --uninstall     Remove plugin from ~/.config/opencode/plugins/
  --status        Show plugin and SearXNG status
  searxng [port]  Start SearXNG Docker container for faster search (default port: ${SEARXNG_DEFAULT_PORT})
  searxng-stop    Stop SearXNG container
  --help, -h      Show this help

Examples:
  # One-shot install (no global install needed)
  bunx opencode-crawl4ai
  npx opencode-crawl4ai

  # Or install globally
  npm i -g opencode-crawl4ai && opencode-crawl4ai

  # Optional: faster search with SearXNG
  opencode-crawl4ai searxng
  export SEARXNG_URL=http://localhost:${SEARXNG_DEFAULT_PORT}
`);
}

async function main() {
  const arg = process.argv[2];

  switch (arg) {
    case "--install":
      await install();
      break;
    case "--uninstall":
      await uninstall();
      break;
    case "--status":
      showStatus();
      break;
    case "searxng":
      startSearXNG(parseInt(process.argv[3] || String(SEARXNG_DEFAULT_PORT), 10));
      break;
    case "searxng-stop":
      stopSearXNG();
      break;
    case "--help":
    case "-h":
      await showHelp();
      break;
    case undefined:
      await install();
      break;
    default:
      console.error(`Unknown command: ${arg}\n`);
      await showHelp();
      process.exit(1);
  }
}

main().catch((err) => {
  console.error("Error:", err.message);
  process.exit(1);
});
