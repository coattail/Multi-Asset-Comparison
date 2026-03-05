#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import { execFileSync, spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, "..");

const fullFontPath = path.resolve(rootDir, "fonts", "STKaiti-full.woff2");
const subsetFontPath = path.resolve(rootDir, "fonts", "STKaiti-subset.woff2");
const subsetCharsPath = path.resolve(rootDir, "fonts", "STKaiti-subset-chars.txt");

const scanFiles = [
  "index.html",
  "multi-assets.html",
  "style.css",
  "app.js",
  "multi-assets.js",
  "house-price-data.js",
  "house-price-data-nbs-70.js",
  "multi-asset-data.js",
].map((item) => path.resolve(rootDir, item));

const mandatoryChars =
  "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz" +
  "年月日周一二三四五六七八九十百千万亿点期指数据来源房价多资产对比城市统计局中原香港美国" +
  "，。！？、；：‘’“”\"'()（）【】《》-—_+=/%.,:;!?&*#@~|<>[]{}\\ ";

function isRenderableChar(char) {
  if (!char) return false;
  const codePoint = char.codePointAt(0);
  if (!Number.isFinite(codePoint)) return false;
  return codePoint >= 0x20 && codePoint !== 0x7f;
}

function addCharsFromText(charSet, text) {
  if (!text) return 0;
  let added = 0;
  for (const char of text) {
    if (!isRenderableChar(char)) continue;
    if (!charSet.has(char)) {
      charSet.add(char);
      added += 1;
    }
  }
  return added;
}

function detectPythonCommand() {
  const candidates = ["python3", "python"];
  for (const cmd of candidates) {
    const result = spawnSync(cmd, ["--version"], { stdio: "ignore" });
    if (result.status === 0) return cmd;
  }
  return "";
}

function ensureFontToolsAvailable(pythonCmd) {
  const result = spawnSync(pythonCmd, ["-m", "fontTools.subset", "--help"], {
    stdio: "ignore",
  });
  return result.status === 0;
}

function formatBytes(bytes) {
  const size = Number(bytes);
  if (!Number.isFinite(size) || size < 0) return "0 B";
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
  return `${(size / (1024 * 1024)).toFixed(2)} MB`;
}

function main() {
  if (!fs.existsSync(fullFontPath)) {
    throw new Error(`Missing full font file: ${fullFontPath}`);
  }

  const chars = new Set();
  const keepExistingChars = String(process.env.FONT_SUBSET_RESET || "").trim() !== "1";

  if (keepExistingChars && fs.existsSync(subsetCharsPath)) {
    addCharsFromText(chars, fs.readFileSync(subsetCharsPath, "utf8"));
  }

  addCharsFromText(chars, mandatoryChars);

  for (const filePath of scanFiles) {
    if (!fs.existsSync(filePath)) continue;
    const text = fs.readFileSync(filePath, "utf8");
    addCharsFromText(chars, text);
  }

  const sortedChars = [...chars].sort((a, b) => a.codePointAt(0) - b.codePointAt(0));
  fs.writeFileSync(subsetCharsPath, `${sortedChars.join("")}\n`, "utf8");

  const pythonCmd = detectPythonCommand();
  if (!pythonCmd) {
    throw new Error("Cannot find python3/python. Please install Python 3 first.");
  }
  if (!ensureFontToolsAvailable(pythonCmd)) {
    throw new Error(
      `Python fontTools is unavailable. Run: ${pythonCmd} -m pip install --upgrade fonttools brotli`,
    );
  }

  execFileSync(
    pythonCmd,
    [
      "-m",
      "fontTools.subset",
      fullFontPath,
      `--text-file=${subsetCharsPath}`,
      `--output-file=${subsetFontPath}`,
      "--flavor=woff2",
      "--layout-features=*",
      "--ignore-missing-unicodes",
    ],
    { stdio: "inherit" },
  );

  const fullFontSize = fs.statSync(fullFontPath).size;
  const subsetFontSize = fs.statSync(subsetFontPath).size;
  const shrinkRatio = fullFontSize > 0 ? ((1 - subsetFontSize / fullFontSize) * 100).toFixed(2) : "0.00";

  // eslint-disable-next-line no-console
  console.log(`Font subset chars: ${sortedChars.length}`);
  // eslint-disable-next-line no-console
  console.log(`Subset chars file: ${subsetCharsPath}`);
  // eslint-disable-next-line no-console
  console.log(`Subset font file: ${subsetFontPath}`);
  // eslint-disable-next-line no-console
  console.log(`Font size: ${formatBytes(fullFontSize)} -> ${formatBytes(subsetFontSize)} (shrink ${shrinkRatio}%)`);
}

main();
