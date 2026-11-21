import { readdir, readFile, stat } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../../", import.meta.url));
const skip = new Set(["node_modules", ".git", ".next", "dist", ".impeccable", ".agent", ".claude", "public", "raw"]);
const failures = [];
let count = 0;
async function visit(directory) {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    if (skip.has(entry.name)) continue;
    const file = path.join(directory, entry.name);
    if (entry.isDirectory()) { await visit(file); continue; }
    if (!entry.name.endsWith(".md")) continue;
    const text = await readFile(file, "utf8");
    for (const match of text.matchAll(/\[[^\]]*\]\(([^)]+)\)/g)) {
      const href = match[1].trim().replace(/^<|>$/g, "").split("#")[0];
      if (!href || /^[a-z]+:/i.test(href)) continue;
      count++;
      try { await stat(path.resolve(path.dirname(file), decodeURIComponent(href))); }
      catch { failures.push(`${path.relative(root, file)}: ${href}`); }
    }
  }
}
await visit(root);
if (failures.length) {
  console.error(failures.join("\n"));
  process.exitCode = 1;
} else console.log(`Verified ${count} local documentation links.`);
