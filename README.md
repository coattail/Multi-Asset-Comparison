# Multi-Asset Dashboard · 多资产与房价可视化

[![Website](https://img.shields.io/website?url=https%3A%2F%2Fsunny-1991.github.io%2FMulti-Asset-Dashboard%2F&up_message=online&down_message=offline)](https://sunny-1991.github.io/Multi-Asset-Dashboard/)
[![NBS Auto Update](https://github.com/Sunny-1991/Multi-Asset-Dashboard/actions/workflows/auto-update-nbs-data.yml/badge.svg)](https://github.com/Sunny-1991/Multi-Asset-Dashboard/actions/workflows/auto-update-nbs-data.yml)
[![Multi-Asset Auto Update](https://github.com/Sunny-1991/Multi-Asset-Dashboard/actions/workflows/auto-update-multi-asset-data.yml/badge.svg)](https://github.com/Sunny-1991/Multi-Asset-Dashboard/actions/workflows/auto-update-multi-asset-data.yml)
[![Node](https://img.shields.io/badge/node-%3E%3D18-43853d?logo=node.js&logoColor=white)](https://nodejs.org/)
[![Python](https://img.shields.io/badge/python-%3E%3D3.9-3776AB?logo=python&logoColor=white)](https://www.python.org/)
[![Architecture](https://img.shields.io/badge/architecture-static%20site-blue)](https://github.com/Sunny-1991/Multi-Asset-Dashboard)

一个面向研究与内容创作的**纯静态仪表盘**：  
支持中国房价双源对比 + 多资产统一时间轴观察，兼顾可读性、导出质量与长期维护。

- 在线主页：[房价主面板](https://sunny-1991.github.io/Multi-Asset-Dashboard/)
- 在线多资产页：[multi-assets.html](https://sunny-1991.github.io/Multi-Asset-Dashboard/multi-assets.html)
- English doc: [README.en.md](./README.en.md)

---

## ✨ 为什么值得用

- **双房价数据源**：中原 6 城 + 统计局 70 城
- **多资产统一观察**：中国房产、美国房产、贵金属、权益类资产
- **分析能力完整**：区间重定基、回撤分析、跨源比较、图内表格
- **生产可用导出**：标准 / 超清 PNG，导图时自动隐藏干扰控件
- **长期维护友好**：GitHub Actions 定时更新数据，静态部署即用

---

## 🧩 功能矩阵

| 模块 | 能力 | 入口 |
| --- | --- | --- |
| 中国房价主面板 | 双数据源切换、跨源对比、回撤分析 | `index.html` |
| 多资产面板 | 统一时间轴、不同资产同屏对比 | `multi-assets.html` |
| 图表交互 | 最多 6 条序列、时间滑块联动、主题切换 | 页面内控件 |
| 导出能力 | 标准 / 超清 PNG 导出 | 图表工具栏 |

---

## 🚀 30 秒本地启动

```bash
git clone https://github.com/Sunny-1991/Multi-Asset-Dashboard.git
cd Multi-Asset-Dashboard
python3 -m http.server 9013
```

浏览器访问：<http://127.0.0.1:9013>

> 请使用 `http://` 访问，避免 `file://` 带来的资源加载限制。

---

## 🔄 数据更新（常用命令）

### 1) 更新中原主数据（Excel）

```bash
node scripts/extract-house-price-data.mjs <excel-file.xlsx>
```

### 2) 更新统计局 70 城

```bash
node scripts/fetch-nbs-70city-secondhand.mjs
```

### 3) 更新多资产数据

```bash
node scripts/build-multi-asset-data.mjs
```

### 4) 手动重建字体子集（可选）

```bash
node scripts/build-font-subset.mjs
```

---

## ⚙️ 自动化更新（GitHub Actions）

- 统计局月更：`.github/workflows/auto-update-nbs-data.yml`
- 多资产日更：`.github/workflows/auto-update-multi-asset-data.yml`

两条流水线都会：

1. 拉取/构建最新数据
2. 自动重建 `STKaiti` 子集字体
3. 若文件变更则自动提交回仓库

---

## ⚡ 性能设计

### 字体优化

- 原始字库：`fonts/STKaiti-full.woff2`
- 线上子集：`fonts/STKaiti-subset.woff2`
- 字符池：`fonts/STKaiti-subset-chars.txt`（随数据更新自动扩容）

### ECharts 回退链路

默认加载：

- `https://cdn.jsdelivr.net/npm/echarts@5.5.1/dist/echarts.min.js`

失败后回退：

1. `./vendor/echarts.min.js`
2. `https://cdn.bootcdn.net/ajax/libs/echarts/5.5.0/echarts.min.js`
3. `https://cdn.staticfile.org/echarts/5.5.0/echarts.min.js`

---

## 🛠️ 环境变量（高级）

### 字体子集

- `SKIP_FONT_SUBSET=1`：跳过自动子集构建
- `FONT_SUBSET_RESET=1`：从零重建字符池（不继承历史）

### NBS 构建

- `NBS_OUTPUT_MIN_MONTH=YYYY-MM`
- `NBS_OUTPUT_BASE_MONTH=YYYY-MM`
- `NBS_OUTPUT_MAX_MONTH=YYYY-MM`
- `NBS_SCAN_START_YEAR=YYYY`

### 多资产构建

- `MULTI_ASSET_START_MONTH=YYYY-MM`

---

## 📁 项目结构

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
├── vendor/
├── scripts/
└── .github/workflows/
```

---

## ❓ FAQ

### 页面一直“正在加载”？

- 确认通过 `http://` 访问而非 `file://`
- 确认 `house-price-data*.js` / `multi-asset-data.js` 存在且内容完整
- 若外网受限，优先保证本地 `vendor/echarts.min.js` 可访问

### 新增城市/资产后字体缺字？

- 重跑对应数据脚本（会自动触发字体子集扩容）
- 或手动运行：`node scripts/build-font-subset.mjs`

### 导出图与当前展示不一致？

- 先点击“一键生成”
- 导出结果遵循当前主题、区间、勾选项与分析开关

---

## 🤝 参与与反馈

- 建议/问题：欢迎提交 [Issues](https://github.com/Sunny-1991/Multi-Asset-Dashboard/issues)
- 代码改进：欢迎发起 PR

---

## 📌 声明

- 数据使用需遵循来源平台条款与当地法规。
- 本项目用于研究与交流，不构成投资建议。
