import test from "node:test";
import assert from "node:assert/strict";

import {
  appendSupplementalMonthsAfterLatest,
  buildAssetPartFromPreviousOutput,
  buildCaseShillerAssets,
  buildEquityAssetFromFred,
  buildEquityAssetFromYahooFinance,
  loadCaseShillerCsvBySeriesId,
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

test("buildEquityAssetFromYahooFinance aggregates daily OHLC into monthly index candles", () => {
  const chartJson = JSON.stringify({
    chart: {
      result: [
        {
          timestamp: [1772411400, 1772497800, 1775003400, 1775089800],
          indicators: {
            quote: [
              {
                open: [10, 11, 20, 21],
                high: [12, 13, 23, 24],
                low: [9, 10, 19, 20],
                close: [11, 12, 22, 23],
              },
            ],
          },
        },
      ],
    },
  });

  const part = buildEquityAssetFromYahooFinance(
    {
      id: "equity_sp500",
      name: "权益类资产·标普500",
      legendName: "标普500",
      source: "Yahoo Finance（^GSPC）",
      symbol: "^GSPC",
    },
    chartJson,
  );

  assert.deepEqual(
    [...part.seriesMap.entries()],
    [
      ["2026-03", 12],
      ["2026-04", 23],
    ],
  );
  assert.deepEqual(
    [...part.ohlcMap.entries()],
    [
      ["2026-03", [10, 12, 9, 13]],
      ["2026-04", [20, 23, 19, 24]],
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

test("buildCaseShillerAssets falls back to cached city data when a FRED payload is unavailable", () => {
  const previousOutputData = {
    dates: ["2026-02", "2026-03"],
    values: {
      us_cs_atxrsa: [245.12, 246.34],
    },
  };

  const part = buildCaseShillerAssets(new Map([["ATXRSA", ""]]), previousOutputData);
  const atlanta = part.assets.find((asset) => asset.id === "us_cs_atxrsa");

  assert.deepEqual([...part.sourceSeriesByAssetId.get("us_cs_atxrsa").entries()], [
    ["2026-02", 245.12],
    ["2026-03", 246.34],
  ]);
  assert.equal(atlanta.source, "S&P CoreLogic Case-Shiller（ATXRSA）（缓存回退）");
});

test("loadCaseShillerCsvBySeriesId keeps cached cities when FRED fetch throws", async () => {
  const previousOutputData = {
    dates: ["2026-02"],
    values: {
      us_cs_atxrsa: [245.12],
    },
  };

  const csvBySeriesId = await loadCaseShillerCsvBySeriesId(previousOutputData, async () => {
    throw new Error("Received unusable payload from FRED");
  }, [{ id: "us_cs_atxrsa", seriesId: "ATXRSA" }]);

  assert.equal(csvBySeriesId.get("ATXRSA"), "");
});
