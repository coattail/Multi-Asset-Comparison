import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import chartAxisUtils from "../chart-axis-utils.js";

const { computeVisibleYAxisRange } = chartAxisUtils;

test("computeVisibleYAxisRange only uses selected series and adds tight padding", () => {
  const result = computeVisibleYAxisRange({
    rendered: [
      { name: "北京", normalized: [100, 140, 180] },
      { name: "上海", normalized: [100, 101.2, 102.4] },
      { name: "深圳", normalized: [100, 99.7, 100.8] },
    ],
    hiddenNames: new Set(["北京"]),
    visibleStartIndex: 0,
    visibleEndIndex: 2,
  });

  assert.equal(result.source, "visible");
  assert.ok(result.min < 99.7);
  assert.ok(result.max > 102.4);
  assert.ok(result.max < 110);
  assert.ok(result.span < 12);
});

test("computeVisibleYAxisRange keeps large-span charts visually tight", () => {
  const result = computeVisibleYAxisRange({
    rendered: [
      { name: "深圳", normalized: [80.44, 120, 571.47] },
    ],
    hiddenNames: new Set(),
    visibleStartIndex: 0,
    visibleEndIndex: 2,
  });

  assert.ok(result.min > 70, `expected min to stay close to data floor, got ${result.min}`);
  assert.ok(result.max < 590, `expected max to stay close to data ceiling, got ${result.max}`);
  assert.ok(result.span < 520, `expected total span to remain tight, got ${result.span}`);
});

test("computeVisibleYAxisRange falls back to all series when every legend item is hidden", () => {
  const result = computeVisibleYAxisRange({
    rendered: [
      { name: "北京", normalized: [100, 140, 180] },
      { name: "上海", normalized: [100, 101.2, 102.4] },
    ],
    hiddenNames: new Set(["北京", "上海"]),
    visibleStartIndex: 0,
    visibleEndIndex: 2,
  });

  assert.equal(result.source, "all");
  assert.ok(result.max > 180);
  assert.ok(result.min < 100);
});

test("app rerenders after legend selection changes so y-axis can recompute", () => {
  const appJsPath = path.join(path.resolve("."), "app.js");
  const appJs = fs.readFileSync(appJsPath, "utf8");

  assert.match(
    appJs,
    /chart\.on\("legendselectchanged",\s*\(params\)\s*=>\s*\{[\s\S]*uiState\.hiddenCityNames\s*=\s*hidden;[\s\S]*render\(\);[\s\S]*\}\);/,
  );
});
