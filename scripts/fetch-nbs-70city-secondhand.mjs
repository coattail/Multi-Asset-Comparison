#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const API_URL = "https://data.stats.gov.cn/easyquery.htm";
const BULLETIN_LIST_URL = "https://www.stats.gov.cn/sj/zxfb/";
const DB_CODE = "csyd";
const INDICATOR_ID = "A010807";
const DEFAULT_SCAN_START_YEAR = 2000;
const REQUEST_TIMEOUT_MS = 20000;
const MAX_RETRIES = 5;
const BULLETIN_LIST_SCAN_PAGES = 3;
const BULLETIN_TITLE_RE = /^(\d{4})年(\d{1,2})月份70个大中城市商品住宅销售价格变动情况$/;

// NBS interface currently returns 71 reg nodes under this indicator.
// To keep the product requirement as "70 cities", we align to 70-city sample by excluding 拉萨.
const EXCLUDED_REG_CODES = new Set(["540100"]);

function isFiniteNumber(value) {
  return typeof value === "number" && Number.isFinite(value);
}

function roundTo(value, digits = 6) {
  if (!isFiniteNumber(value)) return null;
  return Number(value.toFixed(digits));
}

function codeToMonth(code) {
  const text = String(code || "");
  if (!/^\d{6}$/.test(text)) return "";
  return `${text.slice(0, 4)}-${text.slice(4, 6)}`;
}

function normalizeMonthToken(value) {
  const text = String(value || "").trim();
  if (!text) return "";
  if (/^\d{4}-\d{2}$/.test(text)) return text;
  const match = text.match(/^(\d{4})[-/](\d{1,2})$/);
  if (!match) return "";
  return `${match[1]}-${String(Number(match[2])).padStart(2, "0")}`;
}

function formatCurrentMonthUTC() {
  const now = new Date();
  const year = now.getUTCFullYear();
  const month = String(now.getUTCMonth() + 1).padStart(2, "0");
  return `${year}-${month}`;
}

function minMonth(a, b) {
  return a <= b ? a : b;
}

function compareMonth(a, b) {
  return String(a || "").localeCompare(String(b || ""));
}

function nextMonth(month) {
  const [year, monthNumber] = String(month || "").split("-").map(Number);
  if (!Number.isInteger(year) || !Number.isInteger(monthNumber)) return "";
  const date = new Date(Date.UTC(year, monthNumber - 1, 1));
  date.setUTCMonth(date.getUTCMonth() + 1);
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
}

function enumerateMonths(startMonth, endMonth) {
  const [startYear, startM] = startMonth.split("-").map(Number);
  const [endYear, endM] = endMonth.split("-").map(Number);
  const months = [];

  let year = startYear;
  let month = startM;

  while (year < endYear || (year === endYear && month <= endM)) {
    months.push(`${year}-${String(month).padStart(2, "0")}`);
    month += 1;
    if (month > 12) {
      month = 1;
      year += 1;
    }
  }

  return months;
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function stripUrlProtocol(url) {
  return String(url || "").replace(/^https?:\/\//i, "");
}

function normalizeCityName(value) {
  return String(value || "").replace(/<[^>]+>/g, "").replace(/[\s\u00a0\u3000]+/g, "").trim();
}

function decodeHtmlEntities(value) {
  return String(value || "")
    .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number(code)))
    .replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCodePoint(Number.parseInt(code, 16)))
    .replace(/&nbsp;/gi, " ")
    .replace(/&ensp;/gi, " ")
    .replace(/&emsp;/gi, " ")
    .replace(/&quot;/gi, "\"")
    .replace(/&#39;/g, "'")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">");
}

function stripHtmlToText(value) {
  return decodeHtmlEntities(String(value || ""))
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .trim();
}

function extractTagAttribute(tagHtml, attributeName) {
  const pattern = new RegExp(`${attributeName}\\s*=\\s*(['"])(.*?)\\1`, "i");
  const match = String(tagHtml || "").match(pattern);
  return match ? decodeHtmlEntities(match[2]).trim() : "";
}

function parseBulletinMonthFromTitle(title) {
  const match = String(title || "").trim().match(BULLETIN_TITLE_RE);
  if (!match) return "";
  return `${match[1]}-${String(Number(match[2])).padStart(2, "0")}`;
}

export function extractBulletinsFromListingHtml(html, baseUrl = BULLETIN_LIST_URL) {
  const seenMonths = new Set();
  const bulletins = [];

  for (const match of String(html || "").matchAll(/<a\b[^>]*>/gi)) {
    const tagHtml = match[0];
    const title = extractTagAttribute(tagHtml, "title");
    const month = parseBulletinMonthFromTitle(title);
    if (!month || seenMonths.has(month)) continue;

    const href = extractTagAttribute(tagHtml, "href");
    if (!href) continue;

    bulletins.push({
      month,
      title,
      url: new URL(href, baseUrl).toString(),
    });
    seenMonths.add(month);
  }

  bulletins.sort((left, right) => compareMonth(right.month, left.month));
  return bulletins;
}

function extractSecondhandTableHtml(html) {
  const tableMatches = [...String(html || "").matchAll(/<table\b[\s\S]*?<\/table>/gi)];
  for (const match of tableMatches) {
    const index = match.index || 0;
    const context = stripHtmlToText(String(html).slice(Math.max(0, index - 1200), index));
    if (context.includes("二手住宅销售价格指数")) {
      return match[0];
    }
  }
  throw new Error("Unable to locate second-hand housing table in bulletin HTML.");
}

function parseNumberCell(value) {
  const text = stripHtmlToText(value).replace(/,/g, "").trim();
  if (!text) return null;
  const number = Number(text);
  return Number.isFinite(number) ? number : null;
}

function parseBulletinMonthFromHtml(html) {
  const text = stripHtmlToText(html).replace(/\s+/g, "");
  const match = text.match(/(\d{4})年(\d{1,2})月(?:份)?70个大中城市二手住宅销售价格指数/);
  if (!match) return "";
  return `${match[1]}-${String(Number(match[2])).padStart(2, "0")}`;
}

export function parseSecondhandBulletinHtml(html, url) {
  const month = parseBulletinMonthFromHtml(html);
  if (!month) {
    throw new Error(`Unable to determine bulletin month from ${url}`);
  }

  const tableHtml = extractSecondhandTableHtml(html);
  const rows = [...tableHtml.matchAll(/<tr\b[\s\S]*?<\/tr>/gi)];
  const momByCity = new Map();

  rows.forEach((rowMatch) => {
    const cells = [...rowMatch[0].matchAll(/<td\b[\s\S]*?<\/td>/gi)].map((cellMatch) => cellMatch[0]);
    if (cells.length < 8) return;

    const firstMom = parseNumberCell(cells[1]);
    const secondMom = parseNumberCell(cells[5]);
    if (!isFiniteNumber(firstMom) || !isFiniteNumber(secondMom)) return;

    const firstCity = normalizeCityName(stripHtmlToText(cells[0]));
    const secondCity = normalizeCityName(stripHtmlToText(cells[4]));
    if (firstCity) momByCity.set(firstCity, firstMom);
    if (secondCity) momByCity.set(secondCity, secondMom);
  });

  if (momByCity.size === 0) {
    throw new Error(`Unable to parse any second-hand housing rows from ${url}`);
  }

  return {
    month,
    url,
    momByCity,
  };
}

function parseJsonResponseText(rawText) {
  const text = String(rawText || "").trim();
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    // fall through
  }

  const marker = "Markdown Content:";
  const markerIndex = text.lastIndexOf(marker);
  if (markerIndex < 0) return null;
  const candidate = text.slice(markerIndex + marker.length).trim();
  if (!candidate) return null;
  try {
    return JSON.parse(candidate);
  } catch {
    return null;
  }
}

async function fetchJsonFromUrl(url) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const response = await fetch(url, {
      method: "GET",
      headers: {
        Accept: "application/json, text/plain, */*",
        "User-Agent":
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
      },
      signal: controller.signal,
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const text = await response.text();
    const parsed = parseJsonResponseText(text);
    if (!parsed) {
      throw new Error(`unable to parse JSON payload from ${url}`);
    }
    return parsed;
  } finally {
    clearTimeout(timeout);
  }
}

function runCurl(args) {
  return execFileSync("curl", args, {
    encoding: "utf8",
    maxBuffer: 1024 * 1024 * 128,
  });
}

async function fetchTextFromUrl(url) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const response = await fetch(url, {
      method: "GET",
      headers: {
        Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "User-Agent":
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
      },
      signal: controller.signal,
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    return await response.text();
  } finally {
    clearTimeout(timeout);
  }
}

async function fetchTextResilient(url) {
  try {
    return await fetchTextFromUrl(url);
  } catch (fetchError) {
    try {
      return runCurl(["-L", "-sS", "--max-time", "25", "-A", "Mozilla/5.0", url]);
    } catch (curlError) {
      throw curlError || fetchError;
    }
  }
}

async function requestJson(params, attempt = 1) {
  const query = new URLSearchParams({
    ...params,
    k1: String(Date.now() + Math.floor(Math.random() * 100000)),
  });
  const directUrl = `${API_URL}?${query.toString()}`;
  const fallbackUrl = `https://r.jina.ai/http://${stripUrlProtocol(directUrl)}`;
  const candidates = [directUrl, fallbackUrl];

  let lastError = null;
  for (const url of candidates) {
    try {
      return await fetchJsonFromUrl(url);
    } catch (error) {
      lastError = error;
    }
  }

  if (attempt >= MAX_RETRIES) throw lastError || new Error("request failed");
  await sleep(380 * attempt);
  return requestJson(params, attempt + 1);
}

function parseNodeValue(node) {
  if (node?.data?.hasdata !== true) return null;
  const raw = node?.data?.data;
  const num = Number(raw);
  return Number.isFinite(num) ? num : null;
}

function parseNodeWds(node) {
  const wds = Array.isArray(node?.wds) ? node.wds : [];
  const map = new Map();
  wds.forEach((item) => {
    const wdcode = item?.wdcode;
    const valuecode = item?.valuecode;
    if (typeof wdcode === "string" && typeof valuecode === "string") {
      map.set(wdcode, valuecode);
    }
  });
  return map;
}

function getWdnodes(returndata, wdcode) {
  const wdnodes = Array.isArray(returndata?.wdnodes) ? returndata.wdnodes : [];
  const target = wdnodes.find((item) => item?.wdcode === wdcode);
  return Array.isArray(target?.nodes) ? target.nodes : [];
}

async function fetchYearRaw(year) {
  const payload = await requestJson({
    m: "QueryData",
    dbcode: DB_CODE,
    rowcode: "reg",
    colcode: "sj",
    wds: JSON.stringify([{ wdcode: "zb", valuecode: INDICATOR_ID }]),
    dfwds: JSON.stringify([{ wdcode: "sj", valuecode: String(year) }]),
  });

  if (payload?.returncode !== 200 || !payload?.returndata) {
    throw new Error(`NBS API returncode invalid for year ${year}.`);
  }

  return payload.returndata;
}

function cityNameFromMetric(metricName) {
  const raw = String(metricName || "").trim();
  if (!raw) return "";
  return raw.split(/[：:]/)[0].trim();
}

function buildAvailableRange(series, months) {
  let firstIndex = -1;
  let lastIndex = -1;
  for (let i = 0; i < series.length; i += 1) {
    if (isFiniteNumber(series[i])) {
      firstIndex = i;
      break;
    }
  }
  for (let i = series.length - 1; i >= 0; i -= 1) {
    if (isFiniteNumber(series[i])) {
      lastIndex = i;
      break;
    }
  }
  if (firstIndex < 0 || lastIndex < 0 || firstIndex > lastIndex) return "";
  return `${months[firstIndex]}:${months[lastIndex]}`;
}

function appendSourceFileUrl(sourceFile, url) {
  const existing = String(sourceFile || "").trim();
  if (!url) return existing;
  if (!existing) return url;
  if (existing.includes(url)) return existing;
  return `${existing}; ${url}`;
}

function cloneDataset(dataset) {
  return JSON.parse(JSON.stringify(dataset));
}

function loadExistingOutputData(outputPath) {
  const outputJsonPath = outputPath.replace(/\.js$/i, ".json");
  if (!fs.existsSync(outputJsonPath)) return null;
  return JSON.parse(fs.readFileSync(outputJsonPath, "utf8"));
}

function validateRequestedOptions(requestedOutputMinMonth, requestedOutputBaseMonth, requestedMaxMonth) {
  if (!requestedMaxMonth) {
    throw new Error("Invalid month settings. Expected YYYY-MM format.");
  }
  if (requestedOutputMinMonth && requestedOutputMinMonth > requestedMaxMonth) {
    throw new Error(
      `NBS_OUTPUT_MIN_MONTH (${requestedOutputMinMonth}) cannot be later than max month (${requestedMaxMonth}).`,
    );
  }
  if (
    requestedOutputBaseMonth &&
    requestedOutputMinMonth &&
    requestedOutputBaseMonth < requestedOutputMinMonth
  ) {
    throw new Error(
      `NBS_OUTPUT_BASE_MONTH (${requestedOutputBaseMonth}) cannot be earlier than NBS_OUTPUT_MIN_MONTH (${requestedOutputMinMonth}).`,
    );
  }
  if (requestedOutputBaseMonth && requestedOutputBaseMonth > requestedMaxMonth) {
    throw new Error(
      `NBS_OUTPUT_BASE_MONTH (${requestedOutputBaseMonth}) cannot be later than max month (${requestedMaxMonth}).`,
    );
  }
}

function pickPreferredDataset(candidates, requestedOutputMinMonth, requestedOutputBaseMonth) {
  const validCandidates = candidates.filter((candidate) => {
    if (!candidate) return false;
    if (requestedOutputMinMonth && candidate.outputMinMonth !== requestedOutputMinMonth) return false;
    if (requestedOutputBaseMonth && candidate.baseMonth !== requestedOutputBaseMonth) return false;
    return true;
  });

  validCandidates.sort((left, right) => {
    const monthCompare = compareMonth(right.outputMaxMonth || "", left.outputMaxMonth || "");
    if (monthCompare !== 0) return monthCompare;
    return compareMonth(right.latestMonthFromApi || "", left.latestMonthFromApi || "");
  });

  return validCandidates[0] || null;
}

export function appendBulletinToExistingDataset(dataset, bulletin) {
  const cloned = cloneDataset(dataset);
  const previousMonth = cloned.outputMaxMonth || cloned.dates?.[cloned.dates.length - 1];
  const expectedMonth = nextMonth(previousMonth);
  if (!expectedMonth) {
    throw new Error("Existing dataset does not contain a valid latest month.");
  }
  if (bulletin.month !== expectedMonth) {
    throw new Error(`Cannot append bulletin month ${bulletin.month}; expected ${expectedMonth}.`);
  }

  cloned.dates = [...(cloned.dates || []), bulletin.month];
  cloned.rowsParsed = cloned.dates.length;
  cloned.outputMaxMonth = bulletin.month;
  cloned.requestedMaxMonth =
    cloned.requestedMaxMonth && compareMonth(cloned.requestedMaxMonth, bulletin.month) > 0
      ? cloned.requestedMaxMonth
      : bulletin.month;
  cloned.sourceFile = appendSourceFileUrl(cloned.sourceFile, bulletin.url);
  cloned.manualSupplementMonth = bulletin.month;
  cloned.manualSupplementUrl = bulletin.url;
  cloned.manualSupplementMethod = `Appended ${bulletin.month} from official publication table 2 (second-hand housing MoM), chained from ${previousMonth}.`;

  cloned.cities.forEach((city) => {
    const cityKey = normalizeCityName(city.name);
    const momValue = bulletin.momByCity.get(cityKey);
    if (!isFiniteNumber(momValue)) {
      throw new Error(`Missing bulletin mom value for city ${city.name} (${bulletin.month}).`);
    }

    const previousSeries = Array.isArray(cloned.values?.[city.id]) ? [...cloned.values[city.id]] : [];
    const previousValue = previousSeries[previousSeries.length - 1];
    if (!isFiniteNumber(previousValue)) {
      throw new Error(`Missing previous chained value for city ${city.name} (${previousMonth}).`);
    }

    previousSeries.push(roundTo((previousValue * momValue) / 100, 6));
    cloned.values[city.id] = previousSeries;
    city.availableRange = buildAvailableRange(previousSeries, cloned.dates);
    city.updatedAt = bulletin.month;
  });

  return cloned;
}

async function fetchRecentBulletins(targetMonth, latestExistingMonth) {
  const bulletinsByMonth = new Map();

  for (let pageIndex = 0; pageIndex < BULLETIN_LIST_SCAN_PAGES; pageIndex += 1) {
    const pageUrl =
      pageIndex === 0 ? BULLETIN_LIST_URL : new URL(`index_${pageIndex}.html`, BULLETIN_LIST_URL).toString();
    const html = await fetchTextResilient(pageUrl);
    const bulletins = extractBulletinsFromListingHtml(html, pageUrl);

    bulletins.forEach((bulletin) => {
      if (compareMonth(bulletin.month, latestExistingMonth) <= 0) return;
      if (compareMonth(bulletin.month, targetMonth) > 0) return;
      if (!bulletinsByMonth.has(bulletin.month)) {
        bulletinsByMonth.set(bulletin.month, bulletin);
      }
    });
  }

  return [...bulletinsByMonth.values()].sort((left, right) => compareMonth(left.month, right.month));
}

async function supplementDatasetFromBulletins(existingDataset, targetMonth) {
  if (!existingDataset?.outputMaxMonth) {
    throw new Error("Existing dataset is missing outputMaxMonth.");
  }
  if (compareMonth(existingDataset.outputMaxMonth, targetMonth) >= 0) {
    return existingDataset;
  }

  let supplementedDataset = cloneDataset(existingDataset);
  const recentBulletins = await fetchRecentBulletins(targetMonth, supplementedDataset.outputMaxMonth);

  for (const bulletinLink of recentBulletins) {
    if (compareMonth(bulletinLink.month, supplementedDataset.outputMaxMonth) <= 0) continue;
    const html = await fetchTextResilient(bulletinLink.url);
    const bulletin = parseSecondhandBulletinHtml(html, bulletinLink.url);
    supplementedDataset = appendBulletinToExistingDataset(supplementedDataset, bulletin);
  }

  return supplementedDataset;
}

function buildFontSubsetIfEnabled(rootDir) {
  if (String(process.env.SKIP_FONT_SUBSET || "").trim() === "1") {
    // eslint-disable-next-line no-console
    console.log("Skip font subset update (SKIP_FONT_SUBSET=1).");
    return;
  }
  const scriptPath = path.resolve(rootDir, "scripts", "build-font-subset.mjs");
  execFileSync(process.execPath, [scriptPath], { stdio: "inherit" });
}

async function buildDatasetFromApi({
  requestedOutputMinMonth,
  requestedOutputBaseMonth,
  requestedMaxMonth,
  scanStartYear,
}) {
  validateRequestedOptions(requestedOutputMinMonth, requestedOutputBaseMonth, requestedMaxMonth);

  const startYear = requestedOutputMinMonth
    ? Number(requestedOutputMinMonth.slice(0, 4))
    : scanStartYear;
  const endYear = Number(requestedMaxMonth.slice(0, 4));
  if (!Number.isInteger(startYear) || !Number.isInteger(endYear) || startYear > endYear) {
    throw new Error(`Invalid scan year range: ${startYear} -> ${endYear}`);
  }

  const cityOrder = [];
  const cityNameByCode = new Map();
  const momByCity = new Map();
  let earliestMonthFromApi = null;
  let latestMonthFromApi = null;

  for (let year = startYear; year <= endYear; year += 1) {
    // eslint-disable-next-line no-console
    console.log(`Fetching NBS year ${year}...`);
    const returndata = await fetchYearRaw(year);
    const regNodes = getWdnodes(returndata, "reg");

    regNodes.forEach((node) => {
      const code = String(node?.code || "").trim();
      const name = String(node?.name || "").trim();
      if (!code || !name || EXCLUDED_REG_CODES.has(code)) return;
      if (!cityNameByCode.has(code)) {
        cityOrder.push(code);
      }
      cityNameByCode.set(code, cityNameFromMetric(name));
    });

    const datanodes = Array.isArray(returndata?.datanodes) ? returndata.datanodes : [];
    datanodes.forEach((node) => {
      const wdMap = parseNodeWds(node);
      const regCode = wdMap.get("reg");
      const sjCode = wdMap.get("sj");
      if (!regCode || EXCLUDED_REG_CODES.has(regCode) || !sjCode) return;

      const month = codeToMonth(sjCode);
      if (!month || month > requestedMaxMonth) return;
      if (requestedOutputMinMonth && month < requestedOutputMinMonth) return;

      const value = parseNodeValue(node);
      if (!isFiniteNumber(value)) return;

      if (!momByCity.has(regCode)) {
        momByCity.set(regCode, new Map());
      }
      momByCity.get(regCode).set(month, value);
      if (!latestMonthFromApi || month > latestMonthFromApi) {
        latestMonthFromApi = month;
      }
      if (!earliestMonthFromApi || month < earliestMonthFromApi) {
        earliestMonthFromApi = month;
      }
    });

    await sleep(120);
  }

  if (!earliestMonthFromApi || !latestMonthFromApi) {
    throw new Error("Cannot determine available month range from NBS API.");
  }

  const outputMinMonth = requestedOutputMinMonth || earliestMonthFromApi;
  const outputBaseMonth = requestedOutputBaseMonth || outputMinMonth;
  const outputMaxMonth = minMonth(requestedMaxMonth, latestMonthFromApi);
  if (outputMinMonth > outputMaxMonth) {
    throw new Error(`Output min month (${outputMinMonth}) cannot be later than max month (${outputMaxMonth}).`);
  }
  if (outputBaseMonth < outputMinMonth || outputBaseMonth > outputMaxMonth) {
    throw new Error(`NBS_OUTPUT_BASE_MONTH (${outputBaseMonth}) must be within [${outputMinMonth}, ${outputMaxMonth}].`);
  }
  const months = enumerateMonths(outputMinMonth, outputMaxMonth);
  const baseMonthIndex = months.indexOf(outputBaseMonth);
  if (baseMonthIndex < 0) {
    throw new Error(`Cannot locate base month ${outputBaseMonth} in generated timeline.`);
  }

  const values = {};
  const cities = [];

  cityOrder.forEach((regCode) => {
    const cityName = cityNameByCode.get(regCode);
    if (!cityName) return;

    const momSeries = momByCity.get(regCode) || new Map();
    const chainedSeries = new Array(months.length).fill(null);
    chainedSeries[baseMonthIndex] = 100;

    for (let i = baseMonthIndex + 1; i < months.length; i += 1) {
      const prev = chainedSeries[i - 1];
      const momValue = momSeries.get(months[i]);
      if (!isFiniteNumber(prev)) {
        chainedSeries[i] = null;
      } else if (!isFiniteNumber(momValue) || momValue <= 0) {
        chainedSeries[i] = roundTo(prev, 6);
      } else {
        chainedSeries[i] = roundTo((prev * momValue) / 100, 6);
      }
    }

    const cityId = `city_nbs_${regCode}`;
    values[cityId] = chainedSeries;
    cities.push({
      id: cityId,
      name: cityName,
      metricName: `${cityName}:二手住宅销售价格指数(上月=100,链式定基)`,
      column: null,
      indicatorId: INDICATOR_ID,
      availableRange: buildAvailableRange(chainedSeries, months),
      source: "国家统计局(data.stats.gov.cn)",
      frequency: "月",
      updatedAt: latestMonthFromApi || outputMaxMonth,
      rebaseBaseMonth: outputBaseMonth,
      rebaseBaseValue: 100,
      regCode,
      chainedFrom: "上月=100",
    });
  });

  return {
    sourceFile: `${API_URL} (${DB_CODE}/${INDICATOR_ID})`,
    sheetName: "NBS_70city_secondhand",
    baseMonth: outputBaseMonth,
    rowsParsed: months.length,
    dates: months,
    cities,
    values,
    sourceName: "国家统计局70城二手住宅销售价格指数(上月=100,链式定基)",
    indicatorId: INDICATOR_ID,
    dbcode: DB_CODE,
    cityCount: cities.length,
    requestedMaxMonth,
    requestedOutputMinMonth: requestedOutputMinMonth || null,
    requestedOutputBaseMonth: requestedOutputBaseMonth || null,
    outputMaxMonth,
    outputMinMonth,
    earliestMonthFromApi,
    latestMonthFromApi,
    excludedRegCodes: [...EXCLUDED_REG_CODES],
  };
}

function writeOutputFiles(outputData, outputPath) {
  const outputJsonPath = outputPath.replace(/\.js$/i, ".json");
  fs.writeFileSync(outputPath, `window.HOUSE_PRICE_SOURCE_DATA_NBS_70 = ${JSON.stringify(outputData, null, 2)};\n`, "utf8");
  fs.writeFileSync(outputJsonPath, `${JSON.stringify(outputData, null, 2)}\n`, "utf8");
  return outputJsonPath;
}

async function buildOutputData(options) {
  let apiDataset = null;
  let apiError = null;

  try {
    apiDataset = await buildDatasetFromApi(options);
  } catch (error) {
    apiError = error;
    // eslint-disable-next-line no-console
    console.warn(`NBS API path unavailable, will try bulletin fallback: ${error.message}`);
  }

  const existingDataset = loadExistingOutputData(options.outputPath);
  let outputData = pickPreferredDataset(
    [apiDataset, existingDataset],
    options.requestedOutputMinMonth,
    options.requestedOutputBaseMonth,
  );

  if (!outputData) {
    throw apiError || new Error("Unable to build NBS dataset from API or existing snapshot.");
  }

  if (compareMonth(outputData.outputMaxMonth || "", options.requestedMaxMonth) < 0) {
    outputData = await supplementDatasetFromBulletins(outputData, options.requestedMaxMonth);
  }

  return outputData;
}

async function main() {
  const __filename = fileURLToPath(import.meta.url);
  const __dirname = path.dirname(__filename);
  const rootDir = path.resolve(__dirname, "..");

  const outputPath = process.argv[2] || path.resolve(__dirname, "..", "house-price-data-nbs-70.js");
  const requestedOutputMinMonth = normalizeMonthToken(process.env.NBS_OUTPUT_MIN_MONTH);
  const requestedOutputBaseMonth = normalizeMonthToken(process.env.NBS_OUTPUT_BASE_MONTH);
  const requestedMaxMonth =
    normalizeMonthToken(process.env.NBS_OUTPUT_MAX_MONTH) || formatCurrentMonthUTC();
  const scanStartYearRaw = Number(process.env.NBS_SCAN_START_YEAR);
  const scanStartYear = Number.isInteger(scanStartYearRaw)
    ? scanStartYearRaw
    : DEFAULT_SCAN_START_YEAR;

  const outputData = await buildOutputData({
    outputPath,
    requestedOutputMinMonth,
    requestedOutputBaseMonth,
    requestedMaxMonth,
    scanStartYear,
  });
  const outputJsonPath = writeOutputFiles(outputData, outputPath);

  // eslint-disable-next-line no-console
  console.log(`NBS data extracted: ${outputData.cities.length} cities, ${outputData.dates.length} months.`);
  // eslint-disable-next-line no-console
  console.log(`Date range: ${outputData.dates[0]} -> ${outputData.dates[outputData.dates.length - 1]}`);
  // eslint-disable-next-line no-console
  console.log(`JS output: ${outputPath}`);
  // eslint-disable-next-line no-console
  console.log(`JSON output: ${outputJsonPath}`);
  buildFontSubsetIfEnabled(rootDir);
}

const isDirectRun =
  process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (isDirectRun) {
  main().catch((error) => {
    // eslint-disable-next-line no-console
    console.error("Failed to build NBS dataset:", error);
    process.exitCode = 1;
  });
}
