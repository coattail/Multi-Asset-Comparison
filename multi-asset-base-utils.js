(function initMultiAssetBaseUtils(globalScope, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) {
    module.exports = api;
  }
  globalScope.MultiAssetBaseUtils = api;
})(typeof globalThis !== "undefined" ? globalThis : this, () => {
  function isUsableBaseValue(value) {
    return Number.isFinite(value) && value > 0;
  }

  function normalizeSeriesByFirstUsableBase(series, preferredStartIndex = 0, preferredEndIndex = null) {
    const values = Array.isArray(series) ? series : [];
    const safeStartIndex = Math.max(0, Number.isInteger(preferredStartIndex) ? preferredStartIndex : 0);
    const safeEndIndex = Math.min(
      values.length - 1,
      Number.isInteger(preferredEndIndex) ? preferredEndIndex : values.length - 1,
    );

    let baseIndex = -1;
    for (let index = safeStartIndex; index <= safeEndIndex; index += 1) {
      if (isUsableBaseValue(values[index])) {
        baseIndex = index;
        break;
      }
    }

    if (baseIndex < 0) {
      return {
        baseIndex: -1,
        baseRaw: null,
        normalized: values.map(() => null),
      };
    }

    const baseRaw = values[baseIndex];
    const normalized = values.map((value, index) => {
      if (index < baseIndex || !Number.isFinite(value)) return null;
      return (value / baseRaw) * 100;
    });

    return {
      baseIndex,
      baseRaw,
      normalized,
    };
  }

  return {
    normalizeSeriesByFirstUsableBase,
  };
});
