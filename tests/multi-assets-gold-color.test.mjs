import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const source = fs.readFileSync(path.resolve("multi-assets.js"), "utf8");

test("gold uses warm gold colors in light and dark themes", () => {
  assert.match(source, /metal_gold_spot_usd:\s*"#c98b00"/i);
  assert.match(source, /metal_gold_spot_usd:\s*"#ffd21f"/i);
});

test("gold segments stay semi-transparent while retaining their warm color", () => {
  assert.match(
    source,
    /lineOpacity:\s*asset\.id\s*===\s*"metal_gold_spot_usd"\s*\?\s*0\.68\s*:\s*undefined/,
  );
});

test("distinct-color assignment preserves fixed metal colors", () => {
  assert.match(
    source,
    /const fixedMetalPalette\s*=\s*[\s\S]*?METAL_FIXED_COLORS\[themeMode\]/,
  );
  assert.match(
    source,
    /Object\.prototype\.hasOwnProperty\.call\(fixedMetalPalette,\s*assetId\)[\s\S]*?return fixedMetalPalette\[assetId\]/,
  );
  assert.match(source, /if \(getLockedAssetColor\(item\)\) return;/);
});
