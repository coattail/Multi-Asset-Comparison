import test from "node:test";
import assert from "node:assert/strict";

import multiAssetBaseUtils from "../multi-asset-base-utils.js";

const { normalizeSeriesByFirstUsableBase } = multiAssetBaseUtils;

test("normalizeSeriesByFirstUsableBase uses the selected start when data exists there", () => {
  const result = normalizeSeriesByFirstUsableBase([80, 100, 120], 0, 2);

  assert.equal(result.baseIndex, 0);
  assert.equal(result.baseRaw, 80);
  assert.deepEqual(result.normalized, [100, 125, 150]);
});

test("normalizeSeriesByFirstUsableBase lets later-starting assets begin at 100 on their first usable month", () => {
  const result = normalizeSeriesByFirstUsableBase([null, null, 200, 240], 0, 3);

  assert.equal(result.baseIndex, 2);
  assert.equal(result.baseRaw, 200);
  assert.deepEqual(result.normalized, [null, null, 100, 120]);
});
