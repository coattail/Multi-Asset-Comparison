import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const rootDir = path.resolve(".");

function read(relativePath) {
  return fs.readFileSync(path.join(rootDir, relativePath), "utf8");
}

test("index page uses versioned data script URLs for house price datasets", () => {
  const html = read("index.html");
  const appJs = read("app.js");

  assert.match(html, /<script defer src="house-price-data\.js\?v=[^"]+"><\/script>/);
  assert.match(appJs, /scriptUrl:\s*"house-price-data\.js\?v=[^"]+"/);

  assert.match(appJs, /scriptUrl:\s*"house-price-data-nbs-70\.js\?v=[^"]+"/);
});

test("multi-assets page uses versioned data script URL", () => {
  const html = read("multi-assets.html");
  assert.match(html, /<script defer src="multi-asset-data\.js\?v=[^"]+"><\/script>/);
});
