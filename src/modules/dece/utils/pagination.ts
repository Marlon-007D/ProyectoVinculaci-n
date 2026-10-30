/** Page bounds that can never be NaN: an invalid size or page (stored preferences, URL) falls back to safe values. */
export function pageWindow(total: number, page: number, size: number, defaultSize = 10) {
  const safeTotal = Number.isFinite(total) && total > 0 ? Math.floor(total) : 0;
  const safeSize = Number.isInteger(size) && size > 0 ? size : defaultSize;
  const pageCount = Math.max(1, Math.ceil(safeTotal / safeSize));
  const safePage = Number.isInteger(page) ? Math.min(Math.max(page, 0), pageCount - 1) : 0;
  const start = safePage * safeSize;
  const end = Math.min(safeTotal, start + safeSize);
  return { size: safeSize, page: safePage, pageCount, start, end, first: safeTotal ? start + 1 : 0, last: end };
}
