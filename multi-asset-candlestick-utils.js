(function initMultiAssetCandlestickUtils(globalScope, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) {
    module.exports = api;
  }
  globalScope.MultiAssetCandlestickUtils = api;
})(typeof globalThis !== "undefined" ? globalThis : this, () => {
  function clamp(value, min, max) {
    return Math.min(max, Math.max(min, value));
  }

  function resolveCenteredCandlestickBodyWidth(
    bandWidth,
    { ratio = 0.5, minWidth = 2, maxWidth = 12 } = {},
  ) {
    const rawWidth = Math.round(Math.abs(Number(bandWidth) || 0) * ratio);
    const clampedWidth = clamp(rawWidth || minWidth, minWidth, maxWidth);
    const evenWidth = clampedWidth % 2 === 0 ? clampedWidth : clampedWidth - 1;
    return Math.max(minWidth % 2 === 0 ? minWidth : minWidth + 1, evenWidth || 2);
  }

  function buildCenteredCandlestickGeometry({
    centerX,
    openY,
    closeY,
    lowY,
    highY,
    bodyWidth,
  }) {
    const wickX = Math.round(Number(centerX) || 0) + 0.5;
    const normalizedBodyWidth = Math.max(2, Number(bodyWidth) || 2);
    const bodyTop = Math.min(openY, closeY);
    const bodyBottom = Math.max(openY, closeY);
    return {
      wickX,
      bodyX: wickX - normalizedBodyWidth / 2,
      bodyY: bodyTop,
      bodyWidth: normalizedBodyWidth,
      bodyHeight: Math.max(1, bodyBottom - bodyTop),
      highY,
      lowY,
    };
  }

  return {
    buildCenteredCandlestickGeometry,
    resolveCenteredCandlestickBodyWidth,
  };
});
