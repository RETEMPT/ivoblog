import { spawn, spawnSync } from "node:child_process";
import { createRequire } from "node:module";
import { existsSync } from "node:fs";
import net from "node:net";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const scriptDir = dirname(fileURLToPath(import.meta.url));
const ivoblogRoot = resolve(scriptDir, "..");
const repoRoot = resolve(ivoblogRoot, "..");
const blogDir = join(ivoblogRoot, "blog");
const managerDir = join(ivoblogRoot, "my-blog-manager");
const isWindows = process.platform === "win32";
const args = new Set(process.argv.slice(2));
const targetArg = process.argv.find((arg) => arg.startsWith("--target="));
const target = targetArg ? targetArg.split("=")[1] : "all";
const useBrowser = args.has("--browser");

const apps = [
  {
    name: "blog",
    cwd: blogDir,
    preferredPort: 3100,
    routes: ["/", "/about", "/music", "/timeline", "/projects", "/friends", "/photowall"],
  },
  {
    name: "manager",
    cwd: managerDir,
    preferredPort: 3200,
    routes: ["/settings", "/editor", "/drafts", "/music"],
  },
].filter((app) => target === "all" || app.name === target);

function npmSpec(commandArgs) {
  if (isWindows) {
    const npmCli = join(dirname(process.execPath), "node_modules", "npm", "bin", "npm-cli.js");
    if (existsSync(npmCli)) {
      return { command: process.execPath, args: [npmCli, ...commandArgs] };
    }
  }
  return { command: "npm", args: commandArgs };
}

function isPortFree(port) {
  return new Promise((resolveResult) => {
    const server = net.createServer();
    server.once("error", () => resolveResult(false));
    server.once("listening", () => {
      server.close(() => resolveResult(true));
    });
    server.listen(port, "127.0.0.1");
  });
}

async function choosePort(preferredPort) {
  for (let port = preferredPort; port < preferredPort + 30; port += 1) {
    if (await isPortFree(port)) return port;
  }
  throw new Error(`No free port in ${preferredPort}-${preferredPort + 29}`);
}

function startDevServer(app, port) {
  const spec = npmSpec(["run", "dev", "--", "--hostname", "127.0.0.1", "--port", String(port)]);
  const child = spawn(spec.command, spec.args, {
    cwd: app.cwd,
    detached: !isWindows,
    env: {
      ...process.env,
      BROWSER: "none",
      NEXT_TELEMETRY_DISABLED: "1",
    },
    stdio: ["ignore", "pipe", "pipe"],
  });

  const log = (chunk) => {
    const text = String(chunk).trim();
    if (!text) return;
    for (const line of text.split(/\r?\n/)) {
      if (/ready|started|error|failed|local/i.test(line)) {
        console.log(`[${app.name}] ${line}`);
      }
    }
  };

  child.stdout?.on("data", log);
  child.stderr?.on("data", log);
  return child;
}

function stopProcessTree(child) {
  if (!child || child.killed) return;
  if (isWindows) {
    spawnSync("taskkill", ["/F", "/T", "/PID", String(child.pid)], { stdio: "ignore" });
    return;
  }

  try {
    process.kill(-child.pid, "SIGTERM");
  } catch {
    child.kill("SIGTERM");
  }
}

async function waitForRoute(url, timeoutMs = 45_000) {
  const startedAt = Date.now();
  let lastError = "";

  while (Date.now() - startedAt < timeoutMs) {
    try {
      const response = await fetch(url, { cache: "no-store" });
      if (response.status < 500) return true;
      lastError = `HTTP ${response.status}`;
    } catch (error) {
      lastError = error.message;
    }
    await new Promise((resolveTimer) => setTimeout(resolveTimer, 700));
  }

  throw new Error(`Timed out waiting for ${url}: ${lastError}`);
}

async function checkHttpRoute(baseUrl, route) {
  const response = await fetch(`${baseUrl}${route}`, { cache: "no-store" });
  const body = await response.text();
  if (response.status >= 400) {
    throw new Error(`${route} returned HTTP ${response.status}`);
  }
  if (/Application error|Internal Server Error|NEXT_REDIRECT_ERROR/i.test(body)) {
    throw new Error(`${route} rendered an error page`);
  }
  console.log(`[ok] ${baseUrl}${route}`);
}

function loadPlaywright(cwd) {
  const req = createRequire(join(cwd, "package.json"));
  for (const packageName of ["playwright", "@playwright/test"]) {
    try {
      return req(packageName);
    } catch {
      // Optional dependency.
    }
  }
  return null;
}

async function checkBrowserRoutes(app, baseUrl) {
  if (!useBrowser) return;
  const playwright = loadPlaywright(app.cwd);
  if (!playwright?.chromium) {
    console.log(`[skip] ${app.name} browser smoke: Playwright is not installed`);
    return;
  }

  const browser = await playwright.chromium.launch();
  try {
    for (const viewport of [
      { width: 375, height: 812 },
      { width: 1440, height: 900 },
    ]) {
      const page = await browser.newPage({ viewport });
      for (const route of app.routes.slice(0, 4)) {
        await page.goto(`${baseUrl}${route}`, { waitUntil: "networkidle" });
        const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
        if (overflow > 2) {
          throw new Error(`${app.name}${route} has horizontal overflow ${overflow}px at ${viewport.width}px`);
        }
      }
      await page.close();
      console.log(`[ok] ${app.name} browser viewport ${viewport.width}x${viewport.height}`);
    }
  } finally {
    await browser.close();
  }
}

async function smokeApp(app) {
  const port = await choosePort(app.preferredPort);
  const baseUrl = `http://127.0.0.1:${port}`;
  const child = startDevServer(app, port);

  try {
    await waitForRoute(`${baseUrl}${app.routes[0]}`);
    for (const route of app.routes) {
      await checkHttpRoute(baseUrl, route);
    }
    await checkBrowserRoutes(app, baseUrl);
  } finally {
    stopProcessTree(child);
  }
}

async function main() {
  if (apps.length === 0) {
    throw new Error(`Unknown smoke target: ${target}`);
  }

  console.log(`route smoke root: ${repoRoot}`);
  console.log(`target: ${target}${useBrowser ? " + browser" : ""}`);

  for (const app of apps) {
    await smokeApp(app);
  }
}

try {
  await main();
} catch (error) {
  console.error(`[fail] ${error.message}`);
  process.exitCode = 1;
}
