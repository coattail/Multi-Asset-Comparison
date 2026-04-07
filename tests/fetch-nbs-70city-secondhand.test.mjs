import test from "node:test";
import assert from "node:assert/strict";

import {
  appendBulletinToExistingDataset,
  extractBulletinsFromListingHtml,
  parseSecondhandBulletinHtml,
} from "../scripts/fetch-nbs-70city-secondhand.mjs";

test("extractBulletinsFromListingHtml finds monthly housing bulletins from listing page", () => {
  const html = `
    <ul>
      <li>
        <a href="./202604/t20260416_1963001.html" title="2026年3月份70个大中城市商品住宅销售价格变动情况">
          2026年3月份70个大中城市商品住宅销售价格变动情况
        </a>
      </li>
      <li>
        <a href="./202603/t20260316_1962774.html" title="2026年2月份70个大中城市商品住宅销售价格变动情况">
          2026年2月份70个大中城市商品住宅销售价格变动情况
        </a>
      </li>
      <li>
        <a href="./202603/t20260331_1962889.html" title="2026年3月中国采购经理指数运行情况">
          2026年3月中国采购经理指数运行情况
        </a>
      </li>
    </ul>
  `;

  const bulletins = extractBulletinsFromListingHtml(html, "https://www.stats.gov.cn/sj/zxfb/");

  assert.deepEqual(bulletins, [
    {
      month: "2026-03",
      title: "2026年3月份70个大中城市商品住宅销售价格变动情况",
      url: "https://www.stats.gov.cn/sj/zxfb/202604/t20260416_1963001.html",
    },
    {
      month: "2026-02",
      title: "2026年2月份70个大中城市商品住宅销售价格变动情况",
      url: "https://www.stats.gov.cn/sj/zxfb/202603/t20260316_1962774.html",
    },
  ]);
});

test("parseSecondhandBulletinHtml reads month and second-hand mom values from table 2", () => {
  const html = `
    <div class="trs_editor_view">
      <p>表2：2026年3月70个大中城市二手住宅销售价格指数</p>
      <div class="ue_table">
        <table class="trs_word_table">
          <tbody>
            <tr>
              <td>城市</td><td>环比</td><td>同比</td><td>平均</td>
              <td>城市</td><td>环比</td><td>同比</td><td>平均</td>
            </tr>
            <tr>
              <td>北京</td><td>99.5</td><td>97.0</td><td>97.1</td>
              <td>天　津</td><td>100.2</td><td>95.0</td><td>95.1</td>
            </tr>
            <tr>
              <td>石 家 庄</td><td>99.7</td><td>95.8</td><td>95.7</td>
              <td>唐　山</td><td>99.9</td><td>94.0</td><td>94.2</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  `;

  const parsed = parseSecondhandBulletinHtml(
    html,
    "https://www.stats.gov.cn/sj/zxfb/202604/t20260416_1963001.html",
  );

  assert.equal(parsed.month, "2026-03");
  assert.equal(parsed.url, "https://www.stats.gov.cn/sj/zxfb/202604/t20260416_1963001.html");
  assert.deepEqual([...parsed.momByCity.entries()], [
    ["北京", 99.5],
    ["天津", 100.2],
    ["石家庄", 99.7],
    ["唐山", 99.9],
  ]);
});

test("appendBulletinToExistingDataset chains the latest month from bulletin mom values", () => {
  const dataset = {
    sourceFile: "https://data.stats.gov.cn/easyquery.htm (csyd/A010807)",
    sheetName: "NBS_70city_secondhand",
    baseMonth: "2026-01",
    rowsParsed: 2,
    dates: ["2026-01", "2026-02"],
    cities: [
      {
        id: "city_nbs_110000",
        name: "北京",
        metricName: "北京:二手住宅销售价格指数(上月=100,链式定基)",
        indicatorId: "A010807",
        availableRange: "2026-01:2026-02",
        source: "国家统计局(data.stats.gov.cn)",
        frequency: "月",
        updatedAt: "2026-02",
        rebaseBaseMonth: "2026-01",
        rebaseBaseValue: 100,
        regCode: "110000",
        chainedFrom: "上月=100",
      },
      {
        id: "city_nbs_120000",
        name: "天津",
        metricName: "天津:二手住宅销售价格指数(上月=100,链式定基)",
        indicatorId: "A010807",
        availableRange: "2026-01:2026-02",
        source: "国家统计局(data.stats.gov.cn)",
        frequency: "月",
        updatedAt: "2026-02",
        rebaseBaseMonth: "2026-01",
        rebaseBaseValue: 100,
        regCode: "120000",
        chainedFrom: "上月=100",
      },
    ],
    values: {
      city_nbs_110000: [100, 101],
      city_nbs_120000: [100, 98],
    },
    sourceName: "国家统计局70城二手住宅销售价格指数(上月=100,链式定基)",
    indicatorId: "A010807",
    dbcode: "csyd",
    cityCount: 2,
    requestedMaxMonth: "2026-03",
    requestedOutputMinMonth: null,
    requestedOutputBaseMonth: null,
    outputMaxMonth: "2026-02",
    outputMinMonth: "2026-01",
    earliestMonthFromApi: "2026-01",
    latestMonthFromApi: "2026-02",
    excludedRegCodes: ["540100"],
  };

  const nextDataset = appendBulletinToExistingDataset(dataset, {
    month: "2026-03",
    url: "https://www.stats.gov.cn/sj/zxfb/202604/t20260416_1963001.html",
    momByCity: new Map([
      ["北京", 99.5],
      ["天津", 100.2],
    ]),
  });

  assert.deepEqual(nextDataset.dates, ["2026-01", "2026-02", "2026-03"]);
  assert.deepEqual(nextDataset.values.city_nbs_110000, [100, 101, 100.495]);
  assert.deepEqual(nextDataset.values.city_nbs_120000, [100, 98, 98.196]);
  assert.equal(nextDataset.outputMaxMonth, "2026-03");
  assert.equal(nextDataset.rowsParsed, 3);
  assert.equal(nextDataset.manualSupplementMonth, "2026-03");
  assert.equal(
    nextDataset.manualSupplementUrl,
    "https://www.stats.gov.cn/sj/zxfb/202604/t20260416_1963001.html",
  );
  assert.match(nextDataset.sourceFile, /t20260416_1963001\.html$/);
});
