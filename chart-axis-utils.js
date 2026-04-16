(function initChartAxisUtils(globalScope, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) {
    module.exports = api;
  }
  globalScope.ChartAxisUtils = api;
})(typeof globalThis !== "undefined" ? globalThis : this, () => {
  function isFiniteNumber(value) {
    return Number.isFinite(value);
  }

  function collectFiniteValues(series, startIndex, endIndex, output) {
    if (!Array.isArray(series)) return;
    const safeStart = Math.max(0, startIndex);
    const safeEnd = Math.min(series.length - 1, endIndex);
    for (let index = safeStart; index <= safeEnd; index += 1) {
      const value = series[index];
      if (isFiniteNumber(value)) {
        output.push(value);
      }
    }
  }

  function resolveLabelPrecision(span) {
    if (span < 1.2) return 2;
    if (span < 8) return 1;
    return 0;
  }

  function roundAxisValue(value, digits = 2) {
    return Number(value.toFixed(digits));
  }

  function resolveAxisPadding(rawSpan, magnitude) {
    if (!(rawSpan > 0)) {
      return Math.max(Math.abs(magnitude) * 0.02, 1.2);
    }
    if (rawSpan < 5) {
      return Math.max(rawSpan * 0.12, 0.3);
    }
    if (rawSpan < 50) {
      return Math.max(rawSpan * 0.08, 0.8);
    }
    return Math.max(rawSpan * 0.02, 1.5);
  }

  function computeVisibleYAxisRange({
    rendered,
    hiddenNames,
    visibleStartIndex,
    visibleEndIndex,
    defaultMin = 80,
    defaultMax = 120,
  } = {}) {
    const hiddenNameSet = hiddenNames instanceof Set ? hiddenNames : new Set(hiddenNames || []);
    const visibleValues = [];
    const allValues = [];
    const safeStartIndex = Number.isInteger(visibleStartIndex) ? visibleStartIndex : 0;
    const safeEndIndex = Number.isInteger(visibleEndIndex) ? visibleEndIndex : safeStartIndex;

    (Array.isArray(rendered) ? rendered : []).forEach((item) => {
      const series = Array.isArray(item?.normalized) ? item.normalized : null;
      if (!series) return;
      collectFiniteValues(series, safeStartIndex, safeEndIndex, allValues);
      if (!hiddenNameSet.has(item?.name)) {
        collectFiniteValues(series, safeStartIndex, safeEndIndex, visibleValues);
      }
    });

    const sourceValues = visibleValues.length > 0 ? visibleValues : allValues;
    const source = visibleValues.length > 0 ? "visible" : allValues.length > 0 ? "all" : "default";
    if (sourceValues.length === 0) {
      const span = Math.max(1, defaultMax - defaultMin);
      return {
        min: defaultMin,
        max: defaultMax,
        span,
        labelPrecision: resolveLabelPrecision(span),
        source,
      };
    }

    const rawMin = Math.min(...sourceValues);
    const rawMax = Math.max(...sourceValues);
    const rawSpan = Math.max(0, rawMax - rawMin);
    const magnitude = Math.max(1, Math.abs(rawMin), Math.abs(rawMax));
    const padding = resolveAxisPadding(rawSpan, magnitude);

    let min = rawMin - padding;
    let max = rawMax + padding;
    if (!(max > min)) {
      min = rawMin - 1;
      max = rawMax + 1;
    }
    const span = max - min;

    return {
      min: roundAxisValue(min),
      max: roundAxisValue(max),
      span: roundAxisValue(span),
      labelPrecision: resolveLabelPrecision(span),
      source,
    };
  }

  return {
    computeVisibleYAxisRange,
  };
});
