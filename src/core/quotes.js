export const QUOTE_TTL_MS = 5 * 60 * 1000;
export const QUOTE_CACHE_KEY = "stockSelectionCalculator:quotes";
const TAIWAN_SYMBOL_PATTERN = /^\d{4,6}\.TW$/;

export function buildYahooChartUrl(symbol) {
  const encodedSymbol = encodeURIComponent(symbol);
  return `https://query1.finance.yahoo.com/v8/finance/chart/${encodedSymbol}?interval=1m&range=1d`;
}

export async function fetchStockQuote(stock, fetchImpl = fetch, now = new Date()) {
  const response = await fetchImpl(buildYahooChartUrl(stock.symbol));
  if (!response.ok) {
    throw new Error(`Quote request failed with HTTP ${response.status}.`);
  }

  const payload = await response.json();
  return normalizeYahooChartQuote(payload, stock, now);
}

export function normalizeYahooChartQuote(payload, stock, now = new Date()) {
  const result = payload?.chart?.result?.[0];
  const meta = result?.meta;
  const price = firstFiniteNumber(meta?.regularMarketPrice, meta?.previousClose);

  if (!meta || !Number.isFinite(price) || price <= 0) {
    throw new Error(`No usable quote returned for ${stock.symbol}.`);
  }

  return {
    stockId: stock.id,
    symbol: stock.symbol,
    price,
    currency: meta.currency || stock.currency,
    updatedAt: now instanceof Date ? now.toISOString() : String(now),
    source: "yahoo-chart"
  };
}

export function mergeQuoteCache(existingQuotes, quote) {
  return {
    ...(existingQuotes || {}),
    [quote.stockId]: quote
  };
}

export function getCachedQuote(quotes, stockId, now = Date.now(), ttlMs = QUOTE_TTL_MS) {
  if (!isTaiwanStockId(stockId)) {
    return null;
  }

  const quote = quotes?.[stockId];
  if (!quote || !Number.isFinite(quote.price) || quote.price <= 0) {
    return null;
  }

  const updatedAtMs = Date.parse(quote.updatedAt);
  if (!Number.isFinite(updatedAtMs) || now - updatedAtMs > ttlMs) {
    return null;
  }

  return quote;
}

export function normalizeQuoteMap(value) {
  const quotes = {};

  for (const [key, quote] of Object.entries(value || {})) {
    const stockId = quote?.stockId || key;
    if (
      isTaiwanStockId(stockId) &&
      quote &&
      typeof quote === "object" &&
      Number.isFinite(quote.price) &&
      quote.price > 0
    ) {
      quotes[stockId] = {
        stockId,
        symbol: stockId,
        price: quote.price,
        currency: quote.currency || "TWD",
        updatedAt: String(quote.updatedAt || ""),
        source: String(quote.source || "unknown")
      };
    }
  }

  return quotes;
}

function firstFiniteNumber(...values) {
  return values.find((value) => Number.isFinite(value));
}

function isTaiwanStockId(stockId) {
  return typeof stockId === "string" && TAIWAN_SYMBOL_PATTERN.test(stockId);
}
