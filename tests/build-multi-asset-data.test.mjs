import test from "node:test";
import assert from "node:assert/strict";

import {
  buildAssetPartFromPreviousOutput,
  buildEquityAssetFromFred,
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
