import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const css = fs.readFileSync(path.join(path.resolve("."), "style.css"), "utf8");
const tabletCss = css.match(/@media \(max-width: 1120px\), \(hover: none\) and \(pointer: coarse\) and \(orientation: portrait\) \{([\s\S]*?)\n\}/)?.[1] ?? "";
const mobileCss = css.match(/@media \(max-width: 760px\), \(hover: none\) and \(pointer: coarse\) and \(orientation: portrait\) \{([\s\S]*?)\n\}/)?.[1] ?? "";
const narrowMobileCss = css.match(/@media \(max-width: 520px\) \{([\s\S]*?)\n\}/)?.[1] ?? "";

test("multi-asset workspace stacks below the tablet breakpoint", () => {
  assert.match(
    tabletCss,
    /\.page-multi-assets \.workspace\s*\{[^}]*grid-template-columns:\s*minmax\(0, 1fr\)/,
  );
});

test("mobile controls use touch-sized fields and asset rows", () => {
  assert.match(mobileCss, /\.page-multi-assets \.control-block--time-range select\s*\{[^}]*min-height:\s*44px/);
  assert.match(mobileCss, /--asset-row-height:\s*32px/);
  assert.match(mobileCss, /\.page-multi-assets \.asset-item input,[\s\S]*?width:\s*18px[^}]*height:\s*18px/);
  assert.match(mobileCss, /\.china-source-chip\s*\{[^}]*min-height:\s*36px/);
});

test("narrow phones show multi-asset modules one per row", () => {
  assert.match(
    narrowMobileCss,
    /\.page-multi-assets \.asset-list\s*\{[^}]*grid-template-columns:\s*minmax\(0, 1fr\)/,
  );
});
