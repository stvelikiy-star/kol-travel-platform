#!/usr/bin/env node
/**
 * KÖL homepage category media: prepare exactly sized, optimized copies
 * from approved existing project artwork before Next.js builds.
 * Original images are never modified.
 */
import sharp from "sharp";
import { mkdir, stat } from "node:fs/promises";
import { resolve, dirname } from "node:path";

const root = process.cwd();
const width = 960;
const height = 640;
const cards = [
  ["stays-premium.png", "card-stays-960x640.webp"],
  ["tours-premium.png", "card-tours-960x640.webp"],
  ["delivery.webp", "card-delivery-960x640.webp"]
];

const folder = resolve(root, "public/media/kol/sections");
await mkdir(folder, { recursive: true });
for (const [source, target] of cards) {
  const input = resolve(folder, source);
  const output = resolve(folder, target);
  const s = await stat(input);
  if (!s.isFile() || s.size < 5000) throw new Error(`Missing or empty approved image: ${source}`);
  await sharp(input, { failOn: "error" })
    .rotate()
    .resize(width, height, {
      fit: "cover",
      position: sharp.strategy.attention,
      withoutEnlargement: false
    })
    .webp({ quality: 86, effort: 5 })
    .toFile(output);
  const { width: actualWidth, height: actualHeight, format } = await sharp(output).metadata();
  if (actualWidth !== width || actualHeight !== height || format !== "webp") {
    throw new Error(`Wrong card dimensions: ${target}`);
  }
  console.log(`KÖL card media OK: ${target} — ${actualWidth}x${actualHeight}`);
}
