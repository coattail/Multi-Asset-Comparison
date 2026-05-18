import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

test("candlestick charts keep category-axis edge padding so end candles are not clipped", () => {
  const source = fs.readFileSync(path.resolve("multi-assets.js"), "utf8");

  assert.match(
    source,
    /const hasCandlestickAxisPadding\s*=\s*rendered\.some\(\(item\)\s*=>\s*item\.seriesType\s*===\s*"candlestick"\);/,
  );
  assert.match(source, /boundaryGap:\s*hasCandlestickAxisPadding,/);
});
