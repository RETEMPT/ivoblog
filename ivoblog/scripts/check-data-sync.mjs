import { createHash } from "node:crypto";
import {
  copyFileSync,
  cpSync,
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  rmSync,
  statSync,
} from "node:fs";
import { dirname, isAbsolute, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const scriptDir = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(scriptDir, "..");
const sourceRoot = join(repoRoot, "my-blog-manager");
const targetRoot = join(repoRoot, "blog");
const shouldWrite = process.argv.includes("--write");

const syncItems = [
  { type: "file", path: "app/about/about.md" },
  { type: "file", path: "data/albums.ts" },
  { type: "file", path: "data/friends.ts" },
  { type: "file", path: "data/projects.ts" },
  { type: "file", path: "siteConfig.ts" },
  { type: "dir", path: "posts" },
  { type: "dir", path: "chatters" },
  { type: "dir", path: "moments" },
  { type: "dir", path: "public/uploads" },
];

function digest(filePath) {
  return createHash("sha256").update(readFileSync(filePath)).digest("hex");
}

function safeJoin(baseDir, relPath) {
  const base = resolve(baseDir);
  const target = resolve(base, ...relPath.split(/[\\/]+/).filter(Boolean));
  const diff = relative(base, target);
  if (diff && (diff.startsWith("..") || isAbsolute(diff))) {
    throw new Error(`Path escapes project root: ${relPath}`);
  }
  return target;
}

function walkFiles(dirPath, rootPath = dirPath) {
  const entries = readdirSync(dirPath, { withFileTypes: true })
    .filter((entry) => entry.name !== ".DS_Store")
    .sort((a, b) => a.name.localeCompare(b.name));

  return entries.flatMap((entry) => {
    const fullPath = join(dirPath, entry.name);
    if (entry.isDirectory()) {
      return walkFiles(fullPath, rootPath);
    }
    if (!entry.isFile()) {
      return [];
    }
    const relPath = relative(rootPath, fullPath).replace(/\\/g, "/");
    const stat = statSync(fullPath);
    return [`${relPath}\0${stat.size}\0${digest(fullPath)}`];
  });
}

function digestItem(path, type) {
  if (type === "file") {
    return digest(path);
  }
  const hash = createHash("sha256");
  for (const entry of walkFiles(path)) {
    hash.update(entry);
    hash.update("\n");
  }
  return hash.digest("hex");
}

function copyItem(source, target, type) {
  mkdirSync(dirname(target), { recursive: true });
  if (type === "file") {
    copyFileSync(source, target);
    return;
  }
  rmSync(target, { recursive: true, force: true });
  cpSync(source, target, { recursive: true });
}

let ok = true;

for (const item of syncItems) {
  const source = safeJoin(sourceRoot, item.path);
  const target = safeJoin(targetRoot, item.path);

  if (!existsSync(source)) {
    ok = false;
    console.error(`[missing:source] ${item.path}`);
    continue;
  }

  if (!existsSync(target)) {
    if (shouldWrite) {
      copyItem(source, target, item.type);
      console.log(`[fixed] ${item.path} copied from manager to blog`);
      continue;
    }
    ok = false;
    console.error(`[missing:target] ${item.path}`);
    continue;
  }

  const sourceHash = digestItem(source, item.type);
  const targetHash = digestItem(target, item.type);

  if (sourceHash === targetHash) {
    console.log(`[ok] ${item.path}`);
    continue;
  }

  if (shouldWrite) {
    copyItem(source, target, item.type);
    console.log(`[fixed] ${item.path} mirrored from manager to blog`);
  } else {
    ok = false;
    console.error(`[diff] ${item.path} differs. Run check-data-sync.bat --write to mirror manager data.`);
  }
}

if (!ok) {
  process.exitCode = 1;
}
