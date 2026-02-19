#!/usr/bin/env node
/**
 * OpenCode Crawl4AI CLI
 * 
 * Commands:
 *   setup   - Set up SearXNG Docker container for better search
 *   status  - Check SearXNG status
 */

const { execSync } = require("child_process");

const SEARXNG_CONTAINER_NAME = "opencode-crawl4ai-searxng";
const SEARXNG_DEFAULT_PORT = 8888;
const SEARXNG_IMAGE = "searxng/searxng:latest";

function log(msg) {
  console.log(`[opencode-crawl4ai] ${msg}`);
}

function error(msg) {
  console.error(`[opencode-crawl4ai] ERROR: ${msg}`);
  process.exit(1);
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
      `docker ps --filter name=${SEARXNG_CONTAINER_NAME} --format {{.Names}}`,
      { stdio: ["pipe", "pipe", "pipe"] }
    ).toString().trim();
    return result === SEARXNG_CONTAINER_NAME;
  } catch {
    return false;
  }
}

function getExistingContainerPort() {
  try {
    const result = execSync(
      `docker port ${SEARXNG_CONTAINER_NAME} 8080/tcp`,
      { stdio: ["pipe", "pipe", "pipe"] }
    ).toString().trim();
    const match = result.match(/:(\d+)$/);
    return match ? parseInt(match[1], 10) : null;
  } catch {
    return null;
  }
}

function startSearXNG(port) {
  log(`Starting SearXNG on port ${port}...`);
  
  try {
    // Remove existing container if stopped
    execSync(`docker rm -f ${SEARXNG_CONTAINER_NAME} 2>/dev/null`, { stdio: "pipe" });
    
    // Start new container
    execSync(
      `docker run -d --name ${SEARXNG_CONTAINER_NAME} ` +
      `-p ${port}:8080 ` +
      `--restart unless-stopped ` +
      SEARXNG_IMAGE,
      { stdio: "inherit" }
    );
    
    log(`SearXNG started successfully at http://localhost:${port}`);
    log(`Set SEARXNG_URL=http://localhost:${port} for the plugin to use it.`);
  } catch (err) {
    error(`Failed to start SearXNG: ${err}`);
  }
}

function stopSearXNG() {
  log("Stopping SearXNG...");
  
  try {
    execSync(`docker stop ${SEARXNG_CONTAINER_NAME}`, { stdio: "pipe" });
    execSync(`docker rm ${SEARXNG_CONTAINER_NAME}`, { stdio: "pipe" });
    log("SearXNG stopped and removed.");
  } catch {
    log("SearXNG container not found or already stopped.");
  }
}

function showStatus() {
  console.log("\n=== OpenCode Crawl4AI Status ===\n");
  
  // Check Docker
  if (isDockerRunning()) {
    log("✓ Docker is running");
  } else {
    log("✗ Docker is not running");
  }
  
  // Check SearXNG
  if (isSearXNGRunning()) {
    const port = getExistingContainerPort() || SEARXNG_DEFAULT_PORT;
    log(`✓ SearXNG is running on port ${port}`);
    log(`  URL: http://localhost:${port}`);
    log(`  Set: export SEARXNG_URL=http://localhost:${port}`);
  } else {
    log("✗ SearXNG is not running");
    log("  Run: npx @bewinxed/opencode-crawl4ai setup");
  }
  
  console.log("");
}

function showHelp() {
  console.log(`
OpenCode Crawl4AI - Web crawling and search plugin for OpenCode

Usage:
  npx @bewinxed/opencode-crawl4ai <command>

Commands:
  setup [port]    Start SearXNG Docker container (default port: ${SEARXNG_DEFAULT_PORT})
  stop            Stop SearXNG container
  status          Show status of SearXNG and configuration
  help            Show this help message

Environment Variables:
  SEARXNG_URL     URL of SearXNG instance (default: uses Docker container if running)

Examples:
  npx @bewinxed/opencode-crawl4ai setup
  npx @bewinxed/opencode-crawl4ai setup 9000
  SEARXNG_URL=http://searxng.local:8080 npx @bewinxed/opencode-crawl4ai status
`);
}

function main() {
  const args = process.argv.slice(2);
  const command = args[0] || "help";
  const port = args[1] ? parseInt(args[1], 10) : SEARXNG_DEFAULT_PORT;
  
  switch (command) {
    case "setup":
    case "install":
      if (!isDockerRunning()) {
        error("Docker is not running. Please start Docker first.");
      }
      startSearXNG(port);
      break;
    
    case "stop":
    case "uninstall":
      stopSearXNG();
      break;
    
    case "status":
      showStatus();
      break;
    
    case "help":
    case "--help":
    case "-h":
      showHelp();
      break;
    
    default:
      error(`Unknown command: ${command}. Run 'npx @bewinxed/opencode-crawl4ai help' for usage.`);
  }
}

main();
