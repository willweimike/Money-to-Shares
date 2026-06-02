import { getCompany, isKnownCompanyId } from "./stocks.js";

export const QUOTE_TTL_MS = 5 * 60 * 1000;
export const QUOTE_CACHE_KEY = "stockSelectionCalculator:quotes";

export function buildYahooChartUrl(symbol) {
  const encodedSymbol = encodeURIComponent(symbol);
  return `https://query1.finance.yahoo.com/v8/finance/chart/${encodedSymbol}?interval=1m&range=1d`;
}

export async function fetchCompanyQuote(company, fetchImpl = fetch, now = new Date()) {
  const response = await fetchImpl(buildYahooChartUrl(company.symbol));
  if (!response.ok) {
    throw new Error(`Quote request failed with HTTP ${response.status}.`);
  }

  const payload = await response.json();
  return normalizeYahooChartQuote(payload, company, now);
}

export function normalizeYahooChartQuote(payload, company, now = new Date()) {
  const result = payload?.chart?.result?.[0];
  const meta = result?.meta;
  const price = firstFiniteNumber(meta?.regularMarketPrice, meta?.previousClose);

  if (!meta || !Number.isFinite(price) || price <= 0) {
    throw new Error(`No usable quote returned for ${company.symbol}.`);
  }

  return {
    companyId: company.id,
    symbol: company.symbol,
    price,
    currency: meta.currency || company.currency,
    updatedAt: now instanceof Date ? now.toISOString() : String(now),
    source: "yahoo-chart"
  };
}

export function mergeQuoteCache(existingQuotes, quote) {
  return {
    ...(existingQuotes || {}),
    [quote.companyId]: quote
  };
}

export function getCachedQuote(quotes, companyId, now = Date.now(), ttlMs = QUOTE_TTL_MS) {
  if (!isKnownCompanyId(companyId)) {
    return null;
  }

  const quote = quotes?.[companyId];
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

  for (const [companyId, quote] of Object.entries(value || {})) {
    const company = getCompany(companyId);
    if (
      isKnownCompanyId(companyId) &&
      quote &&
      typeof quote === "object" &&
      Number.isFinite(quote.price) &&
      quote.price > 0
    ) {
      quotes[companyId] = {
        companyId,
        symbol: company.symbol,
        price: quote.price,
        currency: quote.currency || company.currency,
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
