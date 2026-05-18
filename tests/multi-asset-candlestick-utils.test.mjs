import test from "node:test";
import assert from "node:assert/strict";

import candlestickUtils from "../multi-asset-candlestick-utils.js";

const { buildCenteredCandlestickGeometry, resolveCenteredCandlestickBodyWidth } = candlestickUtils;

test("resolveCenteredCandlestickBodyWidth keeps dense candles slim while preserving even pixel widths", () => {
  assert.equal(resolveCenteredCandlestickBodyWidth(5.9), 2);
  assert.equal(resolveCenteredCandlestickBodyWidth(17), 8);
});

test("buildCenteredCandlestickGeometry keeps wick and body on the exact same center", () => {
  const geometry = buildCenteredCandlestickGeometry({
    centerX: 100.2,
    openY: 220,
    closeY: 180,
    lowY: 240,
    highY: 160,
    bodyWidth: 4,
  });

  assert.equal(geometry.wickX, 100.5);
  assert.equal(geometry.bodyX + geometry.bodyWidth / 2, geometry.wickX);
});
