#!/usr/bin/env node

import { existsSync, readFileSync } from "node:fs";
import { copyFile, mkdir, readFile, writeFile, unlink } from "node:fs/promises";
import { execSync } from "node:child_process";
import { homedir } from "node:os";
import { createInterface } from "node:readline";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const pluginSource = join(__dirname, "..", "dist", "plugin.js");
const packageJson = join(__dirname, "..", "package.json");

const GLOBAL_PLUGINS_DIR = join(homedir(), ".config", "opencode", "plugins");
const GLOBAL_CONFIG_FILE = join(homedir(), ".config", "opencode", "opencode.json");
const PROJECT_PLUGINS_DIR = resolve(".opencode", "plugins");
const PROJECT_CONFIG_FILE = resolve("opencode.json");

const SEARXNG_CONTAINER = "opencode-crawl4ai-searxng";
const SEARXNG_DEFAULT_PORT = 8888;

async function getVersion() {
  const pkg = JSON.parse(await readFile(packageJson, "utf-8"));
  return pkg.version;
}

function prompt(question) {
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      rl.close();
      resolve(answer.trim());
    });
  });
}

async function pickScope() {
  console.log("\nWhere do you want to install the plugin?\n");
  console.log("  1) User   — ~/.config/opencode/plugins/       (all projects, file copy)");
  console.log("  2) Project — .opencode/plugins/                (this project only, file copy)");
  console.log("  3) User config   — ~/.config/opencode/opencode.json  (npm, all projects)");
  console.log("  4) Project config — opencode.json               (npm, this project only)\n");

  const answer = await prompt("Choice [1/2/3/4] (default: 1): ");

  if (answer === "2") return "project";
  if (answer === "3") return "config-user";
  if (answer === "4") return "config-project";
  return "user";
}

async function installToDir(targetDir, scope) {
  if (!existsSync(pluginSource)) {
    console.error(`\nError: built plugin not found at ${pluginSource}`);
    console.error("This should not happen with a published package. Try reinstalling.");
    process.exit(1);
  }

  const targetFile = join(targetDir, "crawl4ai.js");
  await mkdir(targetDir, { recursive: true });
  await copyFile(pluginSource, targetFile);
  console.log(`\n✓ Plugin installed to: ${targetFile}`);
  console.log(`  Scope: ${scope}`);
}

async function installToConfig(configFile, scope) {
  let config = {};
  if (existsSync(configFile)) {
    try {
      config = JSON.parse(readFileSync(configFile, "utf-8"));
    } catch {
      console.error(`\nError: could not parse ${configFile}`);
      process.exit(1);
    }
  }

  if (!Array.isArray(config.plugin)) config.plugin = [];

  if (config.plugin.includes("opencode-crawl4ai")) {
    console.log(`\n✓ opencode-crawl4ai already listed in ${configFile}`);
    return;
  }

  config.plugin.push("opencode-crawl4ai");
  await writeFile(configFile, JSON.stringify(config, null, 2) + "\n");
  console.log(`\n✓ Added opencode-crawl4ai to ${configFile}`);
  console.log(`  Scope: ${scope}`);
  console.log(`  OpenCode will install it automatically via bun at next startup.`);
}

async function install(scopeFlag) {
  const version = await getVersion();
  console.log(`\nopencode-crawl4ai v${version}`);

  const scope = scopeFlag || (await pickScope());

  if (scope === "project") {
    await installToDir(PROJECT_PLUGINS_DIR, "project (.opencode/plugins/)");
  } else if (scope === "config-project") {
    await installToConfig(PROJECT_CONFIG_FILE, "project config (opencode.json)");
  } else if (scope === "config-user") {
    await installToConfig(GLOBAL_CONFIG_FILE, "user config (~/.config/opencode/opencode.json)");
  } else {
    // default: user plugins dir
    await installToDir(GLOBAL_PLUGINS_DIR, "user (~/.config/opencode/plugins/)");
  }

  console.log("\nRestart OpenCode to activate.");
  console.log("\nTools: crawl4ai_fetch, crawl4ai_search, crawl4ai_extract,");
  console.log("       crawl4ai_screenshot, crawl4ai_crawl, crawl4ai_map");
  console.log("\nOptional: run 'opencode-crawl4ai searxng' for faster search.");
}

async function uninstall() {
  console.log("\nWhere is the plugin installed?\n");
  console.log("  1) User   — ~/.config/opencode/plugins/");
  console.log("  2) Project — .opencode/plugins/");
  console.log("  3) User config   — ~/.config/opencode/opencode.json");
  console.log("  4) Project config — opencode.json\n");

  const answer = await prompt("Choice [1/2/3/4] (default: 1): ");

  if (answer === "2") {
    const f = join(PROJECT_PLUGINS_DIR, "crawl4ai.js");
    if (!existsSync(f)) { console.log("Plugin not found at", f); return; }
    await unlink(f);
    console.log(`✓ Removed: ${f}`);
  } else if (answer === "3") {
    await removeFromConfig(GLOBAL_CONFIG_FILE);
  } else if (answer === "4") {
    await removeFromConfig(PROJECT_CONFIG_FILE);
  } else {
    const f = join(GLOBAL_PLUGINS_DIR, "crawl4ai.js");
    if (!existsSync(f)) { console.log("Plugin not found at", f); return; }
    await unlink(f);
    console.log(`✓ Removed: ${f}`);
  }

  console.log("Restart OpenCode to deactivate.");
}

async function removeFromConfig(configFile) {
  if (!existsSync(configFile)) {
    console.log(`Config file not found: ${configFile}`);
    return;
  }
  let config;
  try { config = JSON.parse(readFileSync(configFile, "utf-8")); } catch {
    console.error(`Could not parse ${configFile}`); return;
  }
  if (!Array.isArray(config.plugin)) { console.log("opencode-crawl4ai not found in config."); return; }
  const before = config.plugin.length;
  config.plugin = config.plugin.filter((p) => p !== "opencode-crawl4ai");
  if (config.plugin.length === before) { console.log("opencode-crawl4ai not found in config."); return; }
  await writeFile(configFile, JSON.stringify(config, null, 2) + "\n");
  console.log(`✓ Removed opencode-crawl4ai from ${configFile}`);
}

function isDockerRunning() {
  try { execSync("docker info", { stdio: "pipe" }); return true; } catch { return false; }
}

function isSearXNGRunning() {
  try {
    const result = execSync(
      `docker ps --filter name=${SEARXNG_CONTAINER} --format {{.Names}}`,
      { stdio: ["pipe", "pipe", "pipe"] }
    ).toString().trim();
    return result === SEARXNG_CONTAINER;
  } catch { return false; }
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
    console.log(`\n✓ SearXNG running at http://localhost:${port}`);
    console.log(`\nSet this env var so the plugin uses it:`);
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
  } catch { console.log("SearXNG container not found or already stopped."); }
}

function showStatus() {
  const running = isSearXNGRunning();
  const globalPlugin = join(GLOBAL_PLUGINS_DIR, "crawl4ai.js");
  const projectPlugin = join(PROJECT_PLUGINS_DIR, "crawl4ai.js");

  let globalConfig = false;
  let projectConfig = false;
  try {
    const g = JSON.parse(readFileSync(GLOBAL_CONFIG_FILE, "utf-8"));
    globalConfig = Array.isArray(g.plugin) && g.plugin.includes("opencode-crawl4ai");
  } catch {}
  try {
    const p = JSON.parse(readFileSync(PROJECT_CONFIG_FILE, "utf-8"));
    projectConfig = Array.isArray(p.plugin) && p.plugin.includes("opencode-crawl4ai");
  } catch {}

  console.log("\n=== opencode-crawl4ai status ===\n");
  console.log(`User plugin dir:    ${existsSync(globalPlugin) ? "✓ installed" : "✗ not installed"}  (${globalPlugin})`);
  console.log(`Project plugin dir: ${existsSync(projectPlugin) ? "✓ installed" : "✗ not installed"}  (${projectPlugin})`);
  console.log(`User config:        ${globalConfig ? "✓ listed" : "✗ not listed"}  (${GLOBAL_CONFIG_FILE})`);
  console.log(`Project config:     ${projectConfig ? "✓ listed" : "✗ not listed"}  (${PROJECT_CONFIG_FILE})`);
  console.log(`SearXNG:            ${running ? "✓ running" : "✗ not running"}`);
  if (running) console.log(`  URL: ${process.env.SEARXNG_URL || `http://localhost:${SEARXNG_DEFAULT_PORT}`}`);
  console.log("");
}

async function showHelp() {
  const version = await getVersion();
  console.log(`opencode-crawl4ai v${version}

Usage: opencode-crawl4ai [command] [options]

Commands:
  (no args)       Interactive install — prompts for scope
  --install       Same as above
  --uninstall     Remove plugin (prompts for scope)
  --status        Show install status across all scopes
  searxng [port]  Start SearXNG Docker container (default port: ${SEARXNG_DEFAULT_PORT})
  searxng-stop    Stop SearXNG container
  --help, -h      Show this help

Install scopes (prompted interactively):
  1) User          — copies plugin.js to ~/.config/opencode/plugins/   [default]
  2) Project       — copies plugin.js to .opencode/plugins/
  3) User config   — adds to ~/.config/opencode/opencode.json (npm, auto-installed by opencode)
  4) Project config — adds to ./opencode.json (npm, auto-installed by opencode)

Examples:
  bunx opencode-crawl4ai          # one-shot install, no global needed
  npx opencode-crawl4ai           # same

  npm i -g opencode-crawl4ai
  opencode-crawl4ai               # install with scope prompt

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
