(function initTimeRangeViewportUtils(globalScope, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) {
    module.exports = api;
  }
  globalScope.TimeRangeViewportUtils = api;
})(typeof globalThis !== "undefined" ? globalThis : this, () => {
  function normalizeMonthToken(value) {
    const text = String(value || "").trim();
    if (!text) return "";
    if (/^\d{4}-\d{2}$/.test(text)) return text;
    const matched = text.match(/^(\d{4})[-/.](\d{1,2})$/);
    if (!matched) return text;
    return `${matched[1]}-${String(Number(matched[2])).padStart(2, "0")}`;
  }

  function findMonthIndexByToken(months, monthValue) {
    const token = normalizeMonthToken(monthValue);
    if (!token) return -1;
    return months.findIndex((month) => normalizeMonthToken(month) === token);
  }

  function isEarlierMonth(nextMonth, previousMonth) {
    const next = normalizeMonthToken(nextMonth);
    const previous = normalizeMonthToken(previousMonth);
    return Boolean(next && previous && next < previous);
  }

  function isLaterMonth(nextMonth, previousMonth) {
    const next = normalizeMonthToken(nextMonth);
    const previous = normalizeMonthToken(previousMonth);
    return Boolean(next && previous && next > previous);
  }

  function resolveViewport({
    months,
    selectedStartMonth,
    selectedEndMonth,
    previousSelectedStartMonth,
    previousSelectedEndMonth,
    zoomStartMonth,
    zoomEndMonth,
  } = {}) {
    if (!Array.isArray(months) || months.length === 0) return null;

    let startIndex = findMonthIndexByToken(months, zoomStartMonth);
    let endIndex = findMonthIndexByToken(months, zoomEndMonth);
    if (startIndex < 0) startIndex = 0;
    if (endIndex < 0) endIndex = months.length - 1;

    // Expanding the selected range must reveal the newly included edge. Keep the
    // opposite edge unchanged so a deliberate manual zoom remains intact.
    if (isEarlierMonth(selectedStartMonth, previousSelectedStartMonth)) {
      startIndex = 0;
    }
    if (isLaterMonth(selectedEndMonth, previousSelectedEndMonth)) {
      endIndex = months.length - 1;
    }

    if (startIndex > endIndex) {
      startIndex = 0;
      endIndex = months.length - 1;
    }

    return {
      startIndex,
      endIndex,
      startMonth: months[startIndex],
      endMonth: months[endIndex],
    };
  }

  return {
    normalizeMonthToken,
    resolveViewport,
  };
});
