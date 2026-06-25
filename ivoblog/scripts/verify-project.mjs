import { spawnSync } from "node:child_process";
import { existsSync, readdirSync, readFileSync, statSync, unlinkSync } from "node:fs";
import net from "node:net";
import { dirname, isAbsolute, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const scriptDir = dirname(fileURLToPath(import.meta.url));
const verifierPath = fileURLToPath(import.meta.url);
const ivoblogRoot = resolve(scriptDir, "..");
const repoRoot = resolve(ivoblogRoot, "..");
const managerDir = join(ivoblogRoot, "my-blog-manager");
const blogDir = join(ivoblogRoot, "blog");
const args = new Set(process.argv.slice(2));
const shouldFix = args.has("--fix") || args.has("--write");
const runFull = args.has("--full");
const runSmoke = args.has("--smoke");
const verboseAssets = args.has("--verbose-assets");
const forceBuild = args.has("--force-build");
const isWindows = process.platform === "win32";
const isCodexSandbox = Boolean(process.env.CODEX_INTERNAL_ORIGINATOR_OVERRIDE || process.env.CODEX_SANDBOX_NETWORK_DISABLED);

const cleanupCandidates = [
  "components/WeatherEffect.tsx",
  "components/WeatherWidget.tsx",
  "public/file.svg",
  "public/globe.svg",
  "public/next.svg",
  "public/vercel.svg",
  "public/window.svg",
];

const textExtensions = new Set([
  ".bat",
  ".css",
  ".html",
  ".js",
  ".json",
  ".jsx",
  ".md",
  ".mjs",
  ".py",
  ".sh",
  ".ts",
  ".tsx",
  ".txt",
  ".yml",
  ".yaml",
]);

const skipDirs = new Set([
  ".git",
  ".next",
  ".turbo",
  "node_modules",
  "uploads",
]);

const results = [];

function record(status, label, detail = "") {
  results.push({ status, label, detail });
  const suffix = detail ? ` - ${detail}` : "";
  console.log(`[${status}] ${label}${suffix}`);
}

function commandSpec(command, commandArgs) {
  if (isWindows && command === "npm") {
    const npmCli = join(dirname(process.execPath), "node_modules", "npm", "bin", "npm-cli.js");
    if (existsSync(npmCli)) {
      return { command: process.execPath, args: [npmCli, ...commandArgs] };
    }
  }

  return { command, args: commandArgs };
}

function runCommand(label, command, commandArgs, cwd) {
  console.log(`\n[run] ${label}`);
  const spec = commandSpec(command, commandArgs);
  const result = spawnSync(spec.command, spec.args, {
    cwd,
    stdio: "inherit",
    shell: false,
  });

  if (result.status === 0) {
    record("ok", label);
    return true;
  }

  const detail = result.error?.message || `exit ${result.status ?? "unknown"}`;
  record("fail", label, detail);
  return false;
}

function runBuildCommand(label, cwd) {
  if (isCodexSandbox && !forceBuild) {
    record(
      "warn",
      label,
      "skipped inside Codex sandbox; run npm.cmd run build in this project directory or pass --force-build",
    );
    return true;
  }

  return runCommand(label, "npm", ["run", "build"], cwd);
}

function isInside(parent, target) {
  const rel = relative(parent, target);
  return rel === "" || (!rel.startsWith("..") && !isAbsolute(rel));
}

function getExt(pathname) {
  const index = pathname.lastIndexOf(".");
  return index === -1 ? "" : pathname.slice(index).toLowerCase();
}

function walkTextFiles(root, files = [], options = {}) {
  for (const entry of readdirSync(root, { withFileTypes: true })) {
    if (skipDirs.has(entry.name) && !(options.includeUploads && entry.name === "uploads")) continue;
    const fullPath = join(root, entry.name);
    if (entry.isDirectory()) {
      walkTextFiles(fullPath, files, options);
      continue;
    }
    if (entry.isFile() && textExtensions.has(getExt(entry.name))) {
      files.push(fullPath);
    }
  }
  return files;
}

function walkFiles(root, files = []) {
  if (!existsSync(root)) return files;
  for (const entry of readdirSync(root, { withFileTypes: true })) {
    const fullPath = join(root, entry.name);
    if (entry.isDirectory()) {
      walkFiles(fullPath, files);
    } else if (entry.isFile()) {
      files.push(fullPath);
    }
  }
  return files;
}

function countReferences(searchText, excludedPath) {
  const roots = [managerDir, blogDir, repoRoot];
  const seen = new Set();
  let count = 0;

  for (const root of roots) {
    if (!existsSync(root)) continue;
    for (const file of walkTextFiles(root)) {
      const normalized = resolve(file);
      if (seen.has(normalized) || normalized === excludedPath || normalized === verifierPath) continue;
      seen.add(normalized);
      try {
        if (readFileSync(normalized, "utf8").includes(searchText)) {
          count += 1;
        }
      } catch {
        // Ignore unreadable generated or binary-like text files.
      }
    }
  }

  return count;
}

function checkCleanupCandidates() {
  const remaining = [];

  for (const relativePath of cleanupCandidates) {
    const absolutePath = resolve(managerDir, relativePath);
    if (!existsSync(absolutePath)) continue;

    const fileName = relativePath.includes("/") ? relativePath.split("/").pop() : relativePath;
    const token = relativePath.startsWith("public/")
      ? fileName
      : fileName.replace(/\.[^.]+$/, "");
    const refs = countReferences(token, absolutePath);

    if (refs === 0) {
      remaining.push(relativePath);
      if (shouldFix) {
        try {
          if (!isInside(managerDir, absolutePath)) {
            record("fail", "cleanup boundary", relativePath);
            continue;
          }
          unlinkSync(absolutePath);
          record("ok", "removed unused residue", relativePath);
        } catch (error) {
          record("fail", "remove unused residue", `${relativePath}: ${error.message}`);
        }
      } else {
        record("warn", "unused residue candidate", relativePath);
      }
    } else {
      record("ok", "cleanup candidate still referenced", `${relativePath} refs=${refs}`);
    }
  }

  if (remaining.length === 0) {
    record("ok", "unused residue scan", "no known residue files found");
  }
}

function canConnect(port) {
  return new Promise((resolveResult) => {
    const socket = net.createConnection({ host: "127.0.0.1", port });
    socket.setTimeout(700);
    socket.once("connect", () => {
      socket.destroy();
      resolveResult(true);
    });
    socket.once("timeout", () => {
      socket.destroy();
      resolveResult(false);
    });
    socket.once("error", () => resolveResult(false));
  });
}

async function checkPorts() {
  const ports = [
    { port: 3000, label: "blog preferred frontend" },
    { port: 3001, label: "manager preferred frontend" },
    { port: 52560, label: "manager preferred backend" },
  ];

  for (const item of ports) {
    const occupied = await canConnect(item.port);
    if (occupied) {
      record("warn", "port occupied", `${item.label} :${item.port}; launchers should choose a safe fallback`);
    } else {
      record("ok", "port available", `${item.label} :${item.port}`);
    }
  }
}

async function checkRuntimeState() {
  const statePath = join(managerDir, "manager_runtime.json");
  if (!existsSync(statePath)) {
    record("ok", "manager runtime state", "no stale state file");
    return;
  }

  try {
    const state = JSON.parse(readFileSync(statePath, "utf8"));
    const backendPort = Number(state.backend_port || 52560);
    const online = Number.isFinite(backendPort) && await canConnect(backendPort);

    if (online) {
      record("ok", "manager runtime state", `backend appears online on :${backendPort}`);
      return;
    }

    if (shouldFix) {
      unlinkSync(statePath);
      record("ok", "removed stale manager runtime state");
    } else {
      record("warn", "stale manager runtime state", "run verify-project --fix to remove it");
    }
  } catch (error) {
    record("warn", "manager runtime state unreadable", error.message);
  }
}

function checkLauncherContracts() {
  const blogStarter = readFileSync(join(repoRoot, "start-blog.bat"), "utf8");
  const managerStarter = readFileSync(join(repoRoot, "start-manager.bat"), "utf8");
  const launcher = readFileSync(join(managerDir, "launcher.py"), "utf8");

  if (blogStarter.includes("3020..3039") && blogStarter.includes("--port %BLOG_PORT%")) {
    record("ok", "blog launcher port fallback");
  } else {
    record("fail", "blog launcher port fallback", "start-blog.bat must choose a free port");
  }

  if (managerStarter.includes("Preferred URL") && managerStarter.includes("actual URL")) {
    record("ok", "manager launcher messaging");
  } else {
    record("warn", "manager launcher messaging", "start-manager.bat should not promise a fixed port");
  }

  if (launcher.includes("choose_available_port") && !launcher.includes("kill_port(")) {
    record("ok", "manager port safety", "uses fallback ports and no broad port kill");
  } else {
    record("fail", "manager port safety", "launcher should avoid broad process cleanup");
  }
}

function checkGitignoreRuntime() {
  const gitignorePath = join(repoRoot, ".gitignore");
  if (!existsSync(gitignorePath)) {
    record("warn", "gitignore", "root .gitignore not found");
    return;
  }

  const content = readFileSync(gitignorePath, "utf8");
  const required = [
    "ivoblog/my-blog-manager/manager_runtime.json",
    "ivoblog/my-blog-manager/window_config.json",
  ];

  for (const pattern of required) {
    if (content.includes(pattern)) {
      record("ok", "gitignore runtime file", pattern);
    } else {
      record("warn", "gitignore runtime file missing", pattern);
    }
  }
}

function checkPackageScripts() {
  for (const [label, root] of [["blog", blogDir], ["manager", managerDir]]) {
    const packagePath = join(root, "package.json");
    const pkg = JSON.parse(readFileSync(packagePath, "utf8"));
    for (const script of ["build", "lint", "typecheck"]) {
      if (pkg.scripts?.[script]) {
        record("ok", `${label} script`, script);
      } else {
        record("fail", `${label} script missing`, script);
      }
    }
  }
}

function checkEmptySkillLinks() {
  const skillRoot = "E:\\ui-ux-pro-max-skill-main\\ui-ux-pro-max-skill-main\\.claude\\skills\\ui-ux-pro-max";
  const brokenPaths = [join(skillRoot, "data"), join(skillRoot, "scripts")];

  for (const path of brokenPaths) {
    if (!existsSync(path)) continue;
    try {
      const stats = statSync(path);
      if (stats.isFile() && stats.size === 0) {
        record("ok", "ui-ux-pro-max skill fallback", `${path} is empty; using src/ui-ux-pro-max fallback`);
      }
    } catch {
      // Skill lives outside the project and may not always be readable.
    }
  }
}

function auditUploadReferences() {
  const uploadsRoot = join(managerDir, "public", "uploads");
  const files = walkFiles(uploadsRoot);
  if (files.length === 0) {
    record("ok", "upload asset audit", "no manager uploads found");
    return;
  }

  const searchableText = [managerDir, blogDir]
    .flatMap((root) => walkTextFiles(root, [], { includeUploads: true }))
    .map((file) => {
      try {
        return readFileSync(file, "utf8");
      } catch {
        return "";
      }
    })
    .join("\n");

  const unreferenced = [];
  for (const file of files) {
    const assetPath = `/${relative(join(managerDir, "public"), file).replace(/\\/g, "/")}`;
    const fileName = assetPath.split("/").pop();
    if (!searchableText.includes(assetPath) && !searchableText.includes(fileName)) {
      unreferenced.push(assetPath);
    }
  }

  const referenced = files.length - unreferenced.length;
  record("ok", "upload asset audit", `${files.length} files, ${referenced} text-referenced, ${unreferenced.length} report-only candidates`);

  if (verboseAssets && unreferenced.length > 0) {
    for (const asset of unreferenced.slice(0, 25)) {
      record("ok", "unreferenced upload candidate", asset);
    }
    if (unreferenced.length > 25) {
      record("ok", "unreferenced upload candidate", `${unreferenced.length - 25} more hidden`);
    }
  }
}

async function main() {
  console.log("iV0 project verifier");
  console.log(`root: ${repoRoot}`);
  console.log(`mode: ${shouldFix ? "fix" : "check"}${runFull ? " + full" : ""}${runSmoke ? " + smoke" : ""}\n`);

  checkLauncherContracts();
  checkGitignoreRuntime();
  checkPackageScripts();
  checkCleanupCandidates();
  auditUploadReferences();
  checkEmptySkillLinks();
  await checkPorts();
  await checkRuntimeState();

  runCommand("data sync check", process.execPath, [join(scriptDir, "check-data-sync.mjs")], repoRoot);

  if (runFull) {
    runCommand("blog lint", "npm", ["run", "lint"], blogDir);
    runCommand("blog typecheck", "npm", ["run", "typecheck"], blogDir);
    runBuildCommand("blog build", blogDir);
    runCommand("manager lint", "npm", ["run", "lint"], managerDir);
    runCommand("manager typecheck", "npm", ["run", "typecheck"], managerDir);
    runBuildCommand("manager build", managerDir);
  }

  if (runSmoke) {
    runCommand("route smoke", process.execPath, [join(scriptDir, "smoke-routes.mjs")], repoRoot);
  }

  const failures = results.filter((item) => item.status === "fail");
  const warnings = results.filter((item) => item.status === "warn");
  console.log(`\nsummary: ${failures.length} fail, ${warnings.length} warn, ${results.length} checks`);

  if (failures.length > 0) {
    process.exitCode = 1;
  }
}

await main();
