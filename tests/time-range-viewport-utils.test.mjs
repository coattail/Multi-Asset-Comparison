import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import viewportUtils from "../time-range-viewport-utils.js";

const months = [
  "2000-01",
  "2005-01",
  "2010-01",
  "2015-01",
  "2020-01",
  "2025-01",
];

test("expanding the selected start reveals the newly included earlier data", () => {
  const viewport = viewportUtils.resolveViewport({
    months: months.slice(0, 5),
    selectedStartMonth: "2000-01",
    selectedEndMonth: "2020-01",
    previousSelectedStartMonth: "2010-01",
    previousSelectedEndMonth: "2020-01",
    zoomStartMonth: "2015-01",
    zoomEndMonth: "2015-01",
  });

  assert.deepEqual(viewport, {
    startIndex: 0,
    endIndex: 3,
    startMonth: "2000-01",
    endMonth: "2015-01",
  });
});

test("expanding the selected end reveals the newly included later data", () => {
  const viewport = viewportUtils.resolveViewport({
    months: months.slice(2),
    selectedStartMonth: "2010-01",
    selectedEndMonth: "2025-01",
    previousSelectedStartMonth: "2010-01",
    previousSelectedEndMonth: "2020-01",
    zoomStartMonth: "2015-01",
    zoomEndMonth: "2020-01",
  });

  assert.deepEqual(viewport, {
    startIndex: 1,
    endIndex: 3,
    startMonth: "2015-01",
    endMonth: "2025-01",
  });
});

test("a narrowed selected range still clips an obsolete viewport to its bounds", () => {
  const viewport = viewportUtils.resolveViewport({
    months: months.slice(2, 5),
    selectedStartMonth: "2010-01",
    selectedEndMonth: "2020-01",
    previousSelectedStartMonth: "2000-01",
    previousSelectedEndMonth: "2025-01",
    zoomStartMonth: "2000-01",
    zoomEndMonth: "2025-01",
  });

  assert.deepEqual(viewport, {
    startIndex: 0,
    endIndex: 2,
    startMonth: "2010-01",
    endMonth: "2020-01",
  });
});

test("both pages redraw when either left-side date selector changes", () => {
  const appJs = fs.readFileSync(path.join(path.resolve("."), "app.js"), "utf8");
  const multiAssetsJs = fs.readFileSync(path.join(path.resolve("."), "multi-assets.js"), "utf8");

  assert.match(
    appJs,
    /startMonthEl\.addEventListener\("change",[\s\S]*?syncTimeZoomWidgetFromMonthSelects\(\);\s*render\(\);[\s\S]*?endMonthEl\.addEventListener\("change",[\s\S]*?syncTimeZoomWidgetFromMonthSelects\(\);\s*render\(\);/,
  );
  assert.match(
    multiAssetsJs,
    /startMonthEl\.addEventListener\("change",[\s\S]*?syncTimeZoomWidgetFromMonthSelects\(\);\s*safeRender\("时间区间变更"\);[\s\S]*?endMonthEl\.addEventListener\("change",[\s\S]*?syncTimeZoomWidgetFromMonthSelects\(\);\s*safeRender\("时间区间变更"\);/,
  );
});
