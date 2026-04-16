import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";

function excelSerialForUtcDate(year, month, day) {
  const epochMs = Date.UTC(1899, 11, 30);
  const targetMs = Date.UTC(year, month - 1, day);
  return String(Math.round((targetMs - epochMs) / (24 * 60 * 60 * 1000)));
}

function makeInlineCell(ref, value) {
  return `<c r="${ref}" t="inlineStr"><is><t>${value}</t></is></c>`;
}

function makeNumberCell(ref, value) {
  return `<c r="${ref}"><v>${value}</v></c>`;
}

function writeMinimalWorkbook(filePath) {
  const rowMap = new Map([
    [33, [
      makeInlineCell("A33", "指标名称"),
      makeInlineCell("B33", "中国:天津:中原领先指数"),
      makeInlineCell("C33", "中国:上海:中原领先指数"),
    ]],
    [34, [
      makeInlineCell("A34", "频率"),
      makeInlineCell("B34", "月"),
      makeInlineCell("C34", "月"),
    ]],
    [36, [
      makeInlineCell("A36", "指标ID"),
      makeInlineCell("B36", "S0109940"),
      makeInlineCell("C36", "S0070073"),
    ]],
    [37, [
      makeInlineCell("A37", "时间区间"),
      makeInlineCell("B37", "2008-01:2008-02"),
      makeInlineCell("C37", "2008-01:2008-02"),
    ]],
    [38, [
      makeInlineCell("A38", "来源"),
      makeInlineCell("B38", "中原地产"),
      makeInlineCell("C38", "中原地产"),
    ]],
    [39, [
      makeInlineCell("A39", "更新时间"),
      makeInlineCell("B39", "2026-04-16"),
      makeInlineCell("C39", "2026-04-16"),
    ]],
    [40, [
      makeNumberCell("A40", excelSerialForUtcDate(2008, 1, 1)),
      makeNumberCell("B40", "100"),
      makeNumberCell("C40", "200"),
    ]],
    [41, [
      makeNumberCell("A41", excelSerialForUtcDate(2008, 2, 1)),
      makeNumberCell("B41", "110"),
      makeNumberCell("C41", "220"),
    ]],
  ]);

  const rowsXml = [...rowMap.entries()]
    .map(([rowNumber, cells]) => `<row r="${rowNumber}">${cells.join("")}</row>`)
    .join("");

  const workbookXml = [
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>',
    '<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">',
    '  <sheets>',
    '    <sheet name="中国_天津_中原领先指数" sheetId="1" r:id="rId1"/>',
    "  </sheets>",
    "</workbook>",
  ].join("");

  const sheetXml = [
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>',
    '<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">',
    `  <sheetData>${rowsXml}</sheetData>`,
    "</worksheet>",
  ].join("");

  const relsXml = [
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>',
    '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">',
    '  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/>',
    "</Relationships>",
  ].join("");

  const contentTypesXml = [
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>',
    '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">',
    '  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>',
    '  <Default Extension="xml" ContentType="application/xml"/>',
    '  <Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>',
    '  <Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>',
    "</Types>",
  ].join("");

  const rootRelsXml = [
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>',
    '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">',
    '  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>',
    "</Relationships>",
  ].join("");

  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "extract-house-price-data-fixture-"));
  fs.mkdirSync(path.join(tempDir, "_rels"));
  fs.mkdirSync(path.join(tempDir, "xl"));
  fs.mkdirSync(path.join(tempDir, "xl", "_rels"));
  fs.mkdirSync(path.join(tempDir, "xl", "worksheets"));

  fs.writeFileSync(path.join(tempDir, "[Content_Types].xml"), contentTypesXml, "utf8");
  fs.writeFileSync(path.join(tempDir, "_rels", ".rels"), rootRelsXml, "utf8");
  fs.writeFileSync(path.join(tempDir, "xl", "workbook.xml"), workbookXml, "utf8");
  fs.writeFileSync(path.join(tempDir, "xl", "_rels", "workbook.xml.rels"), relsXml, "utf8");
  fs.writeFileSync(path.join(tempDir, "xl", "worksheets", "sheet1.xml"), sheetXml, "utf8");

  execFileSync("zip", ["-qr", filePath, "."], { cwd: tempDir });
  fs.rmSync(tempDir, { recursive: true, force: true });
}

test("extract-house-price-data supports workbook headers with country prefix", () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "extract-house-price-data-test-"));
  const workbookPath = path.join(tempDir, "fixture.xlsx");
  const outputPath = path.join(tempDir, "house-price-data.js");
  const outputJsonPath = path.join(tempDir, "house-price-data.json");
  const missingHkPath = path.join(tempDir, "missing-hk-centaline-monthly.json");

  writeMinimalWorkbook(workbookPath);

  execFileSync(
    process.execPath,
    [
      path.resolve("scripts/extract-house-price-data.mjs"),
      workbookPath,
      outputPath,
      missingHkPath,
    ],
    {
      cwd: path.resolve("."),
      env: { ...process.env, SKIP_FONT_SUBSET: "1" },
      stdio: "pipe",
    },
  );

  const output = JSON.parse(fs.readFileSync(outputJsonPath, "utf8"));

  assert.deepEqual(
    output.cities.map((city) => city.name),
    ["天津", "上海"],
  );
  assert.equal(output.sheetName, "中国_天津_中原领先指数");
  assert.deepEqual(output.dates, ["2008-01", "2008-02"]);
  assert.deepEqual(output.values.city_1, [100, 110]);
  assert.deepEqual(output.values.city_2, [100, 110]);

  fs.rmSync(tempDir, { recursive: true, force: true });
});
