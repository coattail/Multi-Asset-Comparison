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

test("candlestick charts use the centered custom renderer so wicks and bodies share one x center", () => {
  const source = fs.readFileSync(path.resolve("multi-assets.js"), "utf8");

  assert.match(source, /const makeCenteredCandlestickRenderItem\s*=\s*\(\)\s*=>\s*\(params,\s*api\)\s*=>/);
  assert.match(source, /type:\s*"custom",[\s\S]*renderItem:\s*makeCenteredCandlestickRenderItem\(\),/);
});

test("custom candlesticks and x-axis zoom both use numeric category indexes", () => {
  const source = fs.readFileSync(path.resolve("multi-assets.js"), "utf8");

  assert.match(source, /const categoryIndex\s*=\s*Number\(api\.value\(0\)\);/);
  assert.match(
    source,
    /Array\.isArray\(tuple\)\s*\?\s*\[tupleIndex,\s*\.\.\.tuple\]\s*:\s*"-"/,
  );
  assert.match(source, /min:\s*hasCandlestickAxisPadding\s*\?\s*visibleStartIndex\s*:\s*visibleStartToken\s*\|\|\s*undefined,/);
  assert.match(source, /max:\s*hasCandlestickAxisPadding\s*\?\s*visibleEndIndex\s*:\s*visibleEndToken\s*\|\|\s*undefined,/);
});

test("slider rerenders chart from the visible viewport instead of retaining offscreen months", () => {
  const source = fs.readFileSync(path.resolve("multi-assets.js"), "utf8");

  assert.match(source, /normalized:\s*viewportSeries,/);
  assert.match(source, /normalizedOhlc:\s*viewportOhlc,/);
  assert.match(
    source,
    /chart\.setOption\(makeOption\(renderList,\s*viewportMonths,\s*viewportStartMonth,\s*viewportEndMonth\),/,
  );
});

test("candlestick viewport data is sliced before custom rendering", () => {
  const source = fs.readFileSync(path.resolve("multi-assets.js"), "utf8");

  assert.match(
    source,
    /const viewportOhlc\s*=\s*Array\.isArray\(normalizedOhlc\)\s*\?\s*normalizedOhlc\.slice\(viewportStartOffset,\s*viewportEndOffset\s*\+\s*1\)\s*:\s*null;/,
  );
});

test("viewport metrics convert the base index into the visible-window coordinate system", () => {
  const source = fs.readFileSync(path.resolve("multi-assets.js"), "utf8");

  assert.match(
    source,
    /const viewportBaseIndex\s*=\s*Math\.max\(0,\s*baseIndex\s*-\s*viewportStartOffset\);/,
  );
  assert.match(source, /latestIndex\s*<=\s*viewportBaseIndex/);
  assert.match(source, /\(latestIndex\s*-\s*viewportBaseIndex\)\s*\/\s*12/);
});
