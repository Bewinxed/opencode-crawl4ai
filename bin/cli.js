#!/usr/bin/env node

import { existsSync } from "node:fs";
import { appendFile, copyFile, mkdir, readFile, unlink } from "node:fs/promises";
import { execSync } from "node:child_process";
import { createInterface } from "node:readline";
import { homedir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const GLOBAL_PLUGINS_DIR = join(homedir(), ".config", "opencode", "plugins");
const LOCAL_PLUGINS_DIR = resolve(".opencode", "plugins");
const source = join(__dirname, "..", "dist", "plugin.js");
const packageJson = join(__dirname, "..", "package.json");

const SEARXNG_CONTAINER = "opencode-crawl4ai-searxng";
const SEARXNG_DEFAULT_PORT = 8888;

async function getVersion() {
  const pkg = JSON.parse(await readFile(packageJson, "utf-8"));
  return pkg.version;
}

function prompt(question) {
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((res) => rl.question(question, (a) => { rl.close(); res(a.trim()); }));
}

function isDockerRunning() {
  try { execSync("docker info", { stdio: "pipe" }); return true; } catch { return false; }
}

function isSearXNGRunning() {
  try {
    const r = execSync(`docker ps --filter name=${SEARXNG_CONTAINER} --format {{.Names}}`, { stdio: ["pipe","pipe","pipe"] }).toString().trim();
    return r === SEARXNG_CONTAINER;
  } catch { return false; }
}

function startSearXNG(port) {
  execSync(`docker rm -f ${SEARXNG_CONTAINER} 2>/dev/null || true`, { stdio: "pipe" });
  execSync(
    `docker run -d --name ${SEARXNG_CONTAINER} -p ${port}:8080 --restart unless-stopped searxng/searxng:latest`,
    { stdio: "inherit" }
  );
}

async function setupSearXNG() {
  console.log("\nSearch backend (used by crawl4ai_search):");
  console.log("  1) Skip — use DuckDuckGo fallback (no setup needed)");
  console.log("  2) I already have a SearXNG instance");
  console.log("  3) Spin up SearXNG via Docker\n");

  const choice = await prompt("Choice [1/2/3] (default: 1): ");

  if (choice === "2") {
    const url = await prompt("SearXNG URL (e.g. http://localhost:8080): ");
    if (url) {
      await writeEnvVar("SEARXNG_URL", url);
      console.log(`✓ SEARXNG_URL=${url} written to shell rc`);
    }
  } else if (choice === "3") {
    if (!isDockerRunning()) {
      console.log("✗ Docker is not running — skipping. Start Docker and run 'opencode-crawl4ai searxng' later.");
      return;
    }
    const portInput = await prompt(`Port (default: ${SEARXNG_DEFAULT_PORT}): `);
    const port = parseInt(portInput || String(SEARXNG_DEFAULT_PORT), 10);
    console.log(`Starting SearXNG on port ${port}...`);
    startSearXNG(port);
    await writeEnvVar("SEARXNG_URL", `http://localhost:${port}`);
    console.log(`✓ SearXNG running at http://localhost:${port}`);
    console.log(`✓ SEARXNG_URL written to shell rc`);
  } else {
    console.log("  Using DuckDuckGo fallback — no setup needed.");
  }
}

async function writeEnvVar(key, value) {
  const shell = process.env.SHELL || "";
  const rc = shell.includes("zsh")
    ? join(homedir(), ".zshrc")
    : shell.includes("fish")
    ? join(homedir(), ".config", "fish", "config.fish")
    : join(homedir(), ".bashrc");
  const line = shell.includes("fish")
    ? `\nset -x ${key} "${value}"\n`
    : `\nexport ${key}="${value}"\n`;
  await appendFile(rc, line);
  console.log(`  (added to ${rc} — run 'source ${rc}' or restart your shell)`);
}

async function install() {
  const version = await getVersion();
  console.log(`\nopencode-crawl4ai v${version}\n`);

  if (!existsSync(source)) {
    console.error(`Error: built plugin not found at ${source}`);
    process.exit(1);
  }

  // 1. Scope
  console.log("Install scope:");
  console.log("  1) Global — ~/.config/opencode/plugins/  (all projects)");
  console.log("  2) Local  — .opencode/plugins/            (this project only)\n");
  const scope = await prompt("Choice [1/2] (default: 1): ");

  const pluginDir = scope === "2" ? LOCAL_PLUGINS_DIR : GLOBAL_PLUGINS_DIR;
  const target = join(pluginDir, "crawl4ai.js");

  await mkdir(pluginDir, { recursive: true });
  await copyFile(source, target);
  console.log(`\n✓ Plugin installed: ${target}`);

  // 2. SearXNG
  await setupSearXNG();

  console.log("\nDone! Restart OpenCode to activate.");
  console.log("Tools: crawl4ai_fetch, crawl4ai_search, crawl4ai_extract, crawl4ai_screenshot, crawl4ai_crawl, crawl4ai_map");
}

async function uninstall() {
  console.log("\nWhere is the plugin installed?");
  console.log("  1) Global — ~/.config/opencode/plugins/");
  console.log("  2) Local  — .opencode/plugins/\n");
  const scope = await prompt("Choice [1/2] (default: 1): ");

  const pluginDir = scope === "2" ? LOCAL_PLUGINS_DIR : GLOBAL_PLUGINS_DIR;
  const target = join(pluginDir, "crawl4ai.js");

  if (!existsSync(target)) {
    console.log(`Plugin not found at ${target}`);
    return;
  }
  await unlink(target);
  console.log(`✓ Removed: ${target}`);
  console.log("Restart OpenCode to deactivate.");
}

function stopSearXNG() {
  console.log("Stopping SearXNG...");
  try {
    execSync(`docker stop ${SEARXNG_CONTAINER}`, { stdio: "pipe" });
    execSync(`docker rm ${SEARXNG_CONTAINER}`, { stdio: "pipe" });
    console.log("✓ SearXNG stopped.");
  } catch { console.log("SearXNG container not found or already stopped."); }
}

async function showHelp() {
  const version = await getVersion();
  console.log(`opencode-crawl4ai v${version}

Usage: opencode-crawl4ai [command]

Commands:
  --install       Install plugin (prompts for scope + SearXNG setup)
  --uninstall     Remove plugin
  searxng [port]  Start SearXNG Docker container (default port: ${SEARXNG_DEFAULT_PORT})
  searxng-stop    Stop SearXNG container
  --help, -h      Show this help

Examples:
  bunx opencode-crawl4ai --install
  npx opencode-crawl4ai --install
  npm i -g opencode-crawl4ai && opencode-crawl4ai --install
`);
}

async function main() {
  const arg = process.argv[2];
  switch (arg) {
    case "--install":  await install(); break;
    case "--uninstall": await uninstall(); break;
    case "searxng":
      if (!isDockerRunning()) { console.error("Docker is not running."); process.exit(1); }
      startSearXNG(parseInt(process.argv[3] || String(SEARXNG_DEFAULT_PORT), 10));
      console.log(`✓ SearXNG running at http://localhost:${process.argv[3] || SEARXNG_DEFAULT_PORT}`);
      break;
    case "searxng-stop": stopSearXNG(); break;
    case "--help": case "-h": case undefined: await showHelp(); break;
    default:
      console.error(`Unknown command: ${arg}\n`);
      await showHelp();
      process.exit(1);
  }
}

main().catch((err) => { console.error("Error:", err.message); process.exit(1); });
