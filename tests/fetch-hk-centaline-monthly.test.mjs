import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const scriptText = fs.readFileSync(
  path.resolve("scripts", "fetch-hk-centaline-monthly.mjs"),
  "utf8",
);

test("Hong Kong CCL fetch defaults to the current month instead of a fixed cutoff", () => {
  assert.match(scriptText, /function\s+formatCurrentMonthUTC\s*\(/);
  assert.match(scriptText, /const\s+endMonth\s*=\s*process\.argv\[5\]\s*\|\|\s*formatCurrentMonthUTC\(\)/);
  assert.doesNotMatch(scriptText, /const\s+endMonth\s*=\s*process\.argv\[5\]\s*\|\|\s*"20\d{2}-\d{2}"/);
});
