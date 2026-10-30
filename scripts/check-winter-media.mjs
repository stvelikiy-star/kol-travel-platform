#!/usr/bin/env node
/* KÖL winter media release gate.
   Run with: npm run check:winter-media
   Strict mode: KOL_REQUIRE_WINTER_MEDIA=1 npm run check:winter-media
   This verifies the actual binary asset dimensions without third-party packages. */
import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";

const base = resolve(process.cwd(), "public/kol-winter");
const required = {
  "scene-stay.webp": [1200, 1500],
  "scene-tours.webp": [1200, 1260],
  "scene-delivery.webp": [1200, 1200],
  "scene-transfer.webp": [1408, 1100],
  "panorama.webp": [2200, 900]
};
const mobile = [
  "scene-stay-mobile.webp",
  "scene-tours-mobile.webp",
  "scene-delivery-mobile.webp",
  "scene-transfer-mobile.webp"
];
const strict = process.env.KOL_REQUIRE_WINTER_MEDIA === "1";
const files = [...Object.keys(required), ...mobile];
const missing = files.filter((name) => !existsSync(resolve(base, name)));

if (missing.length && !strict && missing.length === files.length) {
  console.log("Winter media not installed: existing photography fallback remains active in staging.");
  console.log("IMPORTANT: approved winter WebP images are NOT shipped in this release.");
  console.log("For a release requiring winter photos, set KOL_REQUIRE_WINTER_MEDIA=1.");
  process.exit(0);
}
if (missing.length) {
  console.error("Winter media installation incomplete:", missing.join(", "));
  process.exit(1);
}
function webpDimensions(file) {
  const b = readFileSync(file);
  if (b.length < 30 || b.toString("ascii", 0, 4) !== "RIFF" || b.toString("ascii", 8, 12) !== "WEBP") throw new Error("Invalid WebP container");
  const tag = b.toString("ascii", 12, 16);
  if (tag === "VP8X") return [1 + b.readUIntLE(24, 3), 1 + b.readUIntLE(27, 3)];
  if (tag === "VP8L") {
    if (b[20] !== 0x2f) throw new Error("Invalid VP8L signature");
    const packed = b.readUInt32LE(21);
    return [1 + (packed & 0x3fff), 1 + ((packed >>> 14) & 0x3fff)];
  }
  if (tag === "VP8 ") {
    if (b[23] !== 0x9d || b[24] !== 0x01 || b[25] !== 0x2a) throw new Error("Invalid VP8 signature");
    return [b.readUInt16LE(26) & 0x3fff, b.readUInt16LE(28) & 0x3fff];
  }
  throw new Error("Unsupported WebP format " + tag);
}
let failures = 0;
for (const name of files) {
  try {
    const [width, height] = webpDimensions(resolve(base, name));
    const wanted = required[name];
    if (wanted && (wanted[0] !== width || wanted[1] !== height)) throw new Error("Expected " + wanted.join("x") + ", found " + width + "x" + height);
    if (width < 320 || height < 320) throw new Error("Resolution too low");
    console.log("OK", name, width + "x" + height);
  } catch (err) {
    failures++;
    console.error("FAIL", name, err.message);
  }
}
if (failures) process.exit(1);
console.log("Winter WebP assets verified.");
