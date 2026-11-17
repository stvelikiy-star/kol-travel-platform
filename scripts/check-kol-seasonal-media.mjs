import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
const source = readFileSync("src/components/home/SeasonalShowcase.tsx", "utf8");
const assets = [...source.matchAll(/(?:desktop|mobile):\s*"(\/[^"]+)"/g)].map(x=>x[1]);
assert.equal(assets.length,8,"Four seasons must have both desktop and mobile image references");
for(const asset of assets){
  assert(!asset.includes(".."),"Unsafe asset path");
  assert(existsSync("public"+asset), "Missing seasonal scene asset: "+asset);
}
console.log("KÖL four-season media paths: PASS ("+assets.length+" references)");
