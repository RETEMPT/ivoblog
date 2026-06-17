import { createHash } from "node:crypto";
import { copyFileSync, existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const scriptDir = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(scriptDir, "..");
const shouldWrite = process.argv.includes("--write");

const files = ["albums.ts", "friends.ts", "projects.ts"];

function digest(filePath) {
  return createHash("md5").update(readFileSync(filePath)).digest("hex");
}

let ok = true;

for (const file of files) {
  const source = join(repoRoot, "my-blog-manager", "data", file);
  const target = join(repoRoot, "blog", "data", file);

  if (!existsSync(source) || !existsSync(target)) {
    ok = false;
    console.error(`[missing] ${file}`);
    continue;
  }

  const sourceHash = digest(source);
  const targetHash = digest(target);

  if (sourceHash === targetHash) {
    console.log(`[ok] ${file}`);
    continue;
  }

  if (shouldWrite) {
    copyFileSync(source, target);
    console.log(`[fixed] ${file} copied from manager to blog`);
  } else {
    ok = false;
    console.error(`[diff] ${file} differs. Run check-data-sync.bat --write to mirror manager data.`);
  }
}

if (!ok) {
  process.exitCode = 1;
}
