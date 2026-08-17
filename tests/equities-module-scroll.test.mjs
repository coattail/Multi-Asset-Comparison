import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const css = fs.readFileSync("style.css", "utf8");

test("equities and US housing share the same five-row scroll viewport", () => {
  assert.match(
    css,
    /\.asset-module\[data-category="us_housing"\] \.asset-grid,\s*\.page-multi-assets \.asset-module\[data-category="equities"\] \.asset-grid \{\s*max-height: calc\(/,
  );
  assert.match(
    css,
    /\.asset-module\[data-category="equities"\] \.asset-grid::-webkit-scrollbar \{\s*width: 8px;/,
  );
});
