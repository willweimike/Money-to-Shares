const TAIWAN_CODE_PATTERN = /^\d{4,6}$/;

export const DEFAULT_STOCK_CODES = Object.freeze(["2330", "2454"]);
export const DEFAULT_STOCKS = Object.freeze(DEFAULT_STOCK_CODES.map((code) => Object.freeze(createTaiwanStock(code))));

export function formatCurrencyCode(currency) {
  return currency === "TWD" ? "NTD" : currency;
}

export function normalizeTaiwanCode(input) {
  const code = String(input || "").trim();
  return TAIWAN_CODE_PATTERN.test(code) ? code : null;
}

export function createTaiwanStock(input) {
  const code = normalizeTaiwanCode(input);
  if (!code) {
    return null;
  }

  return {
    id: `${code}.TW`,
    code,
    name: code,
    symbol: `${code}.TW`,
    currency: "TWD",
    market: "TW",
    lotSize: 1000
  };
}

export function normalizeStockList(value) {
  const stocks = [];
  const seen = new Set();
  const entries = Array.isArray(value) ? value : [];

  for (const entry of entries) {
    const code = normalizeTaiwanCode(typeof entry === "object" && entry !== null ? entry.code : entry);
    if (!code || seen.has(code)) {
      continue;
    }

    seen.add(code);
    stocks.push(createTaiwanStock(code));
  }

  return stocks.length > 0 ? stocks : DEFAULT_STOCKS.map((stock) => ({ ...stock }));
}

export function findStock(stocks, stockId) {
  const normalizedStocks = normalizeStockList(stocks);
  return normalizedStocks.find((stock) => stock.id === stockId) || normalizedStocks[0];
}

export function addStockToList(stocks, input) {
  const normalizedStocks = normalizeStockList(stocks);
  const nextStock = createTaiwanStock(input);
  if (!nextStock) {
    return { stocks: normalizedStocks, added: false, reason: "invalid" };
  }

  if (normalizedStocks.some((stock) => stock.id === nextStock.id)) {
    return { stocks: normalizedStocks, added: false, reason: "duplicate" };
  }

  return { stocks: [...normalizedStocks, nextStock], added: true, stock: nextStock };
}

export function removeStockFromList(stocks, stockId, selectedStockId) {
  const remainingStocks = normalizeStockList(stocks).filter((stock) => stock.id !== stockId);
  const nextStocks = remainingStocks.length > 0 ? remainingStocks : DEFAULT_STOCKS.map((stock) => ({ ...stock }));
  const selectedStock = findStock(nextStocks, selectedStockId === stockId ? null : selectedStockId);

  return {
    stocks: nextStocks,
    selectedStockId: selectedStock.id
  };
}
