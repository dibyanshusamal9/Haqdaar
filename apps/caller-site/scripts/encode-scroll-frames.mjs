import { readdir, mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const siteRoot = fileURLToPath(new URL("../", import.meta.url));
const sourceDirectory = process.argv[2];
if (!sourceDirectory) throw new Error("Pass the directory containing the original PNG frames.");
const sources = (await readdir(sourceDirectory))
  .filter((name) => /^ezgif-frame-\d+\.png$/.test(name))
  .sort((a, b) => a.localeCompare(b, "en", { numeric: true }));
if (sources.length !== 160) throw new Error(`Expected 160 frames, found ${sources.length}.`);

const output = path.join(siteRoot, "public/scroll-frames");
await mkdir(output, { recursive: true });
let next = 0;
let completed = 0;
let totalBytes = 0;
// Limit encoder concurrency; keep the source dimensions and every RGB pixel.
await Promise.all(Array.from({ length: 2 }, async () => {
  while (next < sources.length) {
    const index = next++;
    const source = path.join(sourceDirectory, sources[index]);
    const metadata = await sharp(source).metadata();
    if (metadata.width !== 1920 || metadata.height !== 1080) {
      throw new Error(`Unexpected source dimensions: ${sources[index]}`);
    }
    const frame = await sharp(source).webp({ lossless: true, effort: 6 }).toBuffer();
    // Verify the encoded frame against the original, not just its dimensions.
    const originalPixels = await sharp(source).removeAlpha().raw().toBuffer();
    const encodedPixels = await sharp(frame).removeAlpha().raw().toBuffer();
    if (!originalPixels.equals(encodedPixels)) throw new Error(`Pixel mismatch: ${sources[index]}`);
    await writeFile(path.join(output, `frame-${String(index).padStart(3, "0")}.webp`), frame);
    totalBytes += frame.length;
    completed++;
    if (completed % 20 === 0) console.log(`Verified ${completed}/${sources.length} lossless frames`);
  }
}));
console.log(`1920×1080 lossless sequence: ${(totalBytes / 1024 / 1024).toFixed(1)} MiB`);
