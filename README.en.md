# Multi-Asset & Housing Dashboard (Multi-Asset-Dashboard)

[中文说明](./README.md)

A research-oriented, fully static dashboard covering:

- China second-hand housing indices (Centaline 6-city + NBS 70-city)
- Multi-asset comparison (China housing / US housing / metals / equities)
- Rebase analysis, drawdown analysis, in-chart summary table, and HD export

No frontend build/bundling pipeline is required.

---

## 1. Feature Overview

### 1.1 Entry Pages

- `index.html`: housing dashboard (dual source + cross-source comparison)
- `multi-assets.html`: multi-asset dashboard (unified timeline)

### 1.2 Core Capabilities

- Up to 6 concurrent series
- Date selects + dual-handle time slider sync
- Light / dark theme switching
- In-chart stats table toggle
- PNG export (standard / ultra-HD)

---

## 2. Performance & Reliability

### 2.1 Font Subset Strategy

- Full font: `fonts/STKaiti-full.woff2`
- Runtime font: `fonts/STKaiti-subset.woff2`
- Character list: `fonts/STKaiti-subset-chars.txt`
- Subset rebuild is automatically triggered after data updates, and the charset grows incrementally

### 2.2 ECharts Multi-Level Fallback

Primary load:

1. `./vendor/echarts.min.js`

Automatic fallbacks on failure:

1. `https://cdn.jsdelivr.net/npm/echarts@5.5.1/dist/echarts.min.js`
2. `https://cdn.bootcdn.net/ajax/libs/echarts/5.5.0/echarts.min.js`
3. `https://cdn.staticfile.org/echarts/5.5.0/echarts.min.js`

---

## 3. Tech Stack & Runtime

### 3.1 Frontend Stack

- Vanilla HTML / CSS / JavaScript
- ECharts (chart rendering)
- html2canvas (export)

### 3.2 Data Model

The frontend reads static JS data files directly:

- `house-price-data.js` / `house-price-data-nbs-70.js`
- `multi-asset-data.js`
- JSON snapshots for inspection/reuse

### 3.3 Architecture Notes

- No runtime backend API dependency
- No npm bundling/build step
- GitHub Actions updates data files on schedule

---

## 4. Quick Start

### 4.1 Requirements

- Node.js 18+
- Python 3
- Python packages: `fonttools`, `brotli` (for font subset generation)
- Modern browser (latest Chrome / Edge / Safari)

Install font tooling (one-time):

```bash
python3 -m pip install --upgrade fonttools brotli
```

### 4.2 Run Locally

```bash
git clone https://github.com/coattail/Multi-Asset-Comparison.git
cd Multi-Asset-Comparison
python3 -m http.server 9013
```

Open: <http://127.0.0.1:9013>

> Avoid opening pages via `file://`.

---

## 5. Project Structure

```text
Multi-Asset-Dashboard/
├── index.html
├── multi-assets.html
├── style.css
├── app.js
├── multi-assets.js
├── house-price-data.js
├── house-price-data-nbs-70.js
├── multi-asset-data.js
├── fonts/
│   ├── STKaiti-full.woff2
│   ├── STKaiti-subset.woff2
│   └── STKaiti-subset-chars.txt
├── vendor/
│   └── echarts.min.js
├── scripts/
│   ├── build-font-subset.mjs
│   ├── build-multi-asset-data.mjs
│   ├── extract-house-price-data.mjs
│   ├── fetch-hk-centaline-monthly.mjs
│   └── fetch-nbs-70city-secondhand.mjs
├── .github/workflows/
│   ├── auto-update-nbs-data.yml
│   └── auto-update-multi-asset-data.yml
├── README.md
└── README.en.md
```

---

## 6. Data Update Scripts

### 6.1 Hong Kong Monthly Data (optional)

```bash
node scripts/fetch-hk-centaline-monthly.mjs
```

Output: `hk-centaline-monthly.json`

### 6.2 Extract Centaline Data from Excel

```bash
node scripts/extract-house-price-data.mjs <excel-file.xlsx>
```

Outputs:

- `house-price-data.js`
- `house-price-data.json`
- `fonts/STKaiti-subset.woff2`
- `fonts/STKaiti-subset-chars.txt`

### 6.3 Fetch NBS 70-City Dataset

```bash
node scripts/fetch-nbs-70city-secondhand.mjs
```

Outputs:

- `house-price-data-nbs-70.js`
- `house-price-data-nbs-70.json`
- `fonts/STKaiti-subset.woff2`
- `fonts/STKaiti-subset-chars.txt`

### 6.4 Build Multi-Asset Dataset

```bash
node scripts/build-multi-asset-data.mjs
```

Outputs:

- `multi-asset-data.js`
- `multi-asset-data.json`
- `fonts/STKaiti-subset.woff2`
- `fonts/STKaiti-subset-chars.txt`

### 6.5 Manually Rebuild Font Subset

```bash
node scripts/build-font-subset.mjs
```

---

## 7. Environment Variables (Advanced)

### 7.1 Font Subset

- `SKIP_FONT_SUBSET=1`: skip automatic subset generation
- `FONT_SUBSET_RESET=1`: rebuild charset from scratch (do not inherit historical chars)

### 7.2 NBS Builder

- `NBS_OUTPUT_MIN_MONTH=YYYY-MM`
- `NBS_OUTPUT_BASE_MONTH=YYYY-MM`
- `NBS_OUTPUT_MAX_MONTH=YYYY-MM`
- `NBS_SCAN_START_YEAR=YYYY`

### 7.3 Multi-Asset Builder

- `MULTI_ASSET_START_MONTH=YYYY-MM`

---

## 8. GitHub Actions Automation

### 8.1 Monthly NBS Update

File: `.github/workflows/auto-update-nbs-data.yml`

Pipeline:

1. Fetch latest NBS dataset
2. Rebuild font subset automatically
3. Commit & push only if dataset/subset changed

### 8.2 Daily Multi-Asset Update

File: `.github/workflows/auto-update-multi-asset-data.yml`

Pipeline:

1. Build latest multi-asset dataset
2. Rebuild font subset automatically
3. Commit & push only if dataset/subset changed

---

## 9. Deployment Notes

### 9.1 GitHub Pages

Ensure these files are published:

- `index.html`
- `multi-assets.html`
- `style.css`
- `app.js`
- `multi-assets.js`
- `vendor/echarts.min.js`
- `fonts/STKaiti-subset.woff2`
- `house-price-data.js`
- `house-price-data-nbs-70.js`
- `multi-asset-data.js`

### 9.2 Cache Refresh

- Hard refresh: `Cmd/Ctrl + Shift + R`
- Or bump static asset query versions (`?v=...`)

---

## 10. FAQ

### Q1. The page remains on "Loading..."

- Make sure you are using `http://` instead of `file://`
- Verify data files exist and are valid
- Make sure GitHub Pages also publishes `vendor/echarts.min.js` and `fonts/STKaiti-subset.woff2`
- Check whether external CDN access is restricted in your network

### Q2. Export output differs from the on-screen chart

- Click "Generate" before exporting
- Export follows the current state (theme, range, selected series, toggles)

### Q3. New labels show missing glyphs

- Re-run the corresponding data script (font subset auto-expands)
- Or run `node scripts/build-font-subset.mjs` manually

---

## 11. Disclaimer

- Data usage must comply with source terms and applicable regulations.
- This project is for research and communication, not investment advice.
