import test from "node:test";
import assert from "node:assert/strict";

import {
  appendSupplementalMonthsAfterLatest,
  buildAssetPartFromPreviousOutput,
  buildEquityAssetFromFred,
  parseStatMuseMonthlyMetalHtml,
} from "../scripts/build-multi-asset-data.mjs";

test("buildAssetPartFromPreviousOutput reconstructs monthly values and ohlc from cached output", () => {
  const previousOutputData = {
    dates: ["2026-01", "2026-02", "2026-03"],
    values: {
      equity_sp500: [6123.45, null, 6345.67],
    },
    ohlcValues: {
      equity_sp500: [
        [6100, 6123.45, 6050, 6150],
        null,
        [6200, 6345.67, 6188, 6360],
      ],
    },
  };

  const part = buildAssetPartFromPreviousOutput(previousOutputData, {
    id: "equity_sp500",
    name: "权益类资产·标普500",
    legendName: "标普500",
    categoryKey: "equities",
    categoryLabel: "权益类资产",
    subgroupKey: "equities",
    subgroupLabel: "权益类资产",
    source: "缓存",
    unit: "指数",
  });

  assert.deepEqual(
    [...part.seriesMap.entries()],
    [
      ["2026-01", 6123.45],
      ["2026-03", 6345.67],
    ],
  );
  assert.deepEqual(
    [...part.ohlcMap.entries()],
    [
      ["2026-01", [6100, 6123.45, 6050, 6150]],
      ["2026-03", [6200, 6345.67, 6188, 6360]],
    ],
  );
});

test("buildEquityAssetFromFred aggregates daily closes into monthly close and derived ohlc", () => {
  const csvText = [
    "observation_date,SP500",
    "2026-03-02,10",
    "2026-03-03,",
    "2026-03-17,14",
    "2026-03-31,20",
    "2026-04-01,25",
    "2026-04-30,30",
  ].join("\n");

  const part = buildEquityAssetFromFred(
    {
      id: "equity_sp500",
      name: "权益类资产·标普500",
      legendName: "标普500",
      source: "FRED（SP500）",
    },
    csvText,
  );

  assert.deepEqual(
    [...part.seriesMap.entries()],
    [
      ["2026-03", 20],
      ["2026-04", 30],
    ],
  );
  assert.deepEqual(
    [...part.ohlcMap.entries()],
    [
      ["2026-03", [10, 20, 10, 20]],
      ["2026-04", [25, 30, 25, 30]],
    ],
  );
});

test("parseStatMuseMonthlyMetalHtml extracts month-end closes from the rendered table", () => {
  const html = `
    <tr>
      <td><span>May 2026</span></td>
      <td><span>$4,626.45</span></td>
      <td><span>$4,773.83</span></td>
      <td><span>$4,500.85</span></td>
      <td><span>$4,540.07</span></td>
    </tr>
    <tr>
      <td><span>April 2026</span></td>
      <td><span>$4,696.60</span></td>
      <td><span>$4,889.70</span></td>
      <td><span>$4,509.96</span></td>
      <td><span>$4,622.59</span></td>
    </tr>
  `;

  assert.deepEqual([...parseStatMuseMonthlyMetalHtml(html).entries()], [
    ["2026-05", 4540.07],
    ["2026-04", 4622.59],
  ]);
});

test("appendSupplementalMonthsAfterLatest only appends months newer than the cached series", () => {
  const target = new Map([
    ["2026-01", 100],
    ["2026-02", 110],
    ["2026-03", 120],
  ]);
  const supplement = new Map([
    ["2026-02", 999],
    ["2026-03", 888],
    ["2026-04", 130],
    ["2026-05", 140],
  ]);

  assert.deepEqual(appendSupplementalMonthsAfterLatest(target, supplement), ["2026-04", "2026-05"]);
  assert.deepEqual([...target.entries()], [
    ["2026-01", 100],
    ["2026-02", 110],
    ["2026-03", 120],
    ["2026-04", 130],
    ["2026-05", 140],
  ]);
});
