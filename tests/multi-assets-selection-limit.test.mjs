import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

test("multi-asset comparison allows all seven Magnificent Seven stocks at once", () => {
  const script = fs.readFileSync("multi-assets.js", "utf8");
  const html = fs.readFileSync("multi-assets.html", "utf8");

  assert.match(script, /const MAX_SELECTED_ASSET_COUNT = 7;/);
  assert.match(html, /资产（可选多至7个）/);
  assert.match(html, /全选前7个/);
});
