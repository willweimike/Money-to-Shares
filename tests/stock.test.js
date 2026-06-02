import assert from "node:assert/strict";
import test from "node:test";

import { calculateShares, formatCalculation } from "../src/core/calculator.js";
import {
  buildYahooChartUrl,
  fetchCompanyQuote,
  getCachedQuote,
  normalizeQuoteMap,
  normalizeYahooChartQuote
} from "../src/core/quotes.js";
import { parseSelectedAmount } from "../src/core/selection.js";
import { getSettings, saveSettings, getQuotes, saveQuotes } from "../src/core/storage.js";
import { getCompany } from "../src/core/stocks.js";

test("parseSelectedAmount accepts one positive money-like number", () => {
  assert.equal(parseSelectedAmount("  $1,234.56  "), 1234.56);
  assert.equal(parseSelectedAmount("NTD 10,000 元"), 10000);
  assert.equal(parseSelectedAmount("10000"), 10000);
});

test("parseSelectedAmount rejects ambiguous or invalid selections", () => {
  assert.equal(parseSelectedAmount("buy 100 shares"), null);
  assert.equal(parseSelectedAmount("100 200"), null);
  assert.equal(parseSelectedAmount("-100"), null);
  assert.equal(parseSelectedAmount("0"), null);
  assert.equal(parseSelectedAmount("12,34"), null);
});

test("calculateShares handles US shares and Taiwan lots", () => {
  const nvidia = getCompany("nvidia");
  const nvdaResult = calculateShares(1000, { price: 250, currency: "USD" }, nvidia);
  assert.deepEqual(
    {
      shares: nvdaResult.shares,
      lots: nvdaResult.lots,
      oddLots: nvdaResult.oddLots
    },
    { shares: 4, lots: 0, oddLots: 4 }
  );
  assert.equal(formatCalculation(nvdaResult, nvidia), "4 股, USD 1,000 / 250");

  const tsmc = getCompany("tsmc");
  const tsmcResult = calculateShares(1_500_000, { price: 900, currency: "TWD" }, tsmc);
  assert.deepEqual(
    {
      shares: tsmcResult.shares,
      lots: tsmcResult.lots,
      oddLots: tsmcResult.oddLots
    },
    { shares: 1666, lots: 1, oddLots: 666 }
  );
  assert.equal(formatCalculation(tsmcResult, tsmc), "1,666 股 (1 張 666 股), NTD 1,500,000 / 900");
});

test("calculateShares rejects unusable amounts or prices", () => {
  assert.throws(() => calculateShares(0, { price: 100 }, getCompany("nvidia")), /Amount/);
  assert.throws(() => calculateShares(1000, { price: 0 }, getCompany("nvidia")), /Quote price/);
});

test("normalizeYahooChartQuote returns a stable quote", () => {
  const quote = normalizeYahooChartQuote(
    {
      chart: {
        result: [
          {
            meta: {
              regularMarketPrice: 123.45,
              previousClose: 120,
              currency: "USD"
            }
          }
        ]
      }
    },
    getCompany("nvidia"),
    new Date("2026-06-02T10:00:00.000Z")
  );

  assert.deepEqual(quote, {
    companyId: "nvidia",
    symbol: "NVDA",
    price: 123.45,
    currency: "USD",
    updatedAt: "2026-06-02T10:00:00.000Z",
    source: "yahoo-chart"
  });
});

test("normalizeYahooChartQuote falls back to previous close and rejects empty payloads", () => {
  const quote = normalizeYahooChartQuote(
    {
      chart: {
        result: [{ meta: { previousClose: 88, currency: "TWD" } }]
      }
    },
    getCompany("tsmc"),
    new Date("2026-06-02T10:00:00.000Z")
  );
  assert.equal(quote.price, 88);
  assert.throws(() => normalizeYahooChartQuote({}, getCompany("tsmc")), /No usable quote/);
});

test("fetchCompanyQuote calls the Yahoo chart URL and handles HTTP errors", async () => {
  const company = getCompany("mediatek");
  const fetchOk = async (url) => {
    assert.equal(url, buildYahooChartUrl(company.symbol));
    return {
      ok: true,
      async json() {
        return {
          chart: {
            result: [{ meta: { regularMarketPrice: 1200, currency: "TWD" } }]
          }
        };
      }
    };
  };

  const quote = await fetchCompanyQuote(company, fetchOk, new Date("2026-06-02T10:00:00.000Z"));
  assert.equal(quote.symbol, "2454.TW");
  assert.equal(quote.price, 1200);

  await assert.rejects(
    () => fetchCompanyQuote(company, async () => ({ ok: false, status: 429 }), new Date()),
    /HTTP 429/
  );
});

test("getCachedQuote respects ttl and normalizeQuoteMap removes invalid entries", () => {
  const now = Date.parse("2026-06-02T10:05:00.000Z");
  const quotes = normalizeQuoteMap({
    nvidia: {
      price: 100,
      currency: "USD",
      updatedAt: "2026-06-02T10:04:00.000Z",
      source: "test"
    },
    unknown: {
      price: 1
    },
    tsmc: {
      price: 0
    }
  });

  assert.equal(getCachedQuote(quotes, "nvidia", now)?.price, 100);
  assert.equal(getCachedQuote(quotes, "nvidia", now + 10 * 60 * 1000), null);
  assert.deepEqual(Object.keys(quotes), ["nvidia"]);
});

test("settings and quotes round trip through storage wrappers", async () => {
  const runtime = { lastError: null };
  const sync = new MemoryStorageArea();
  const local = new MemoryStorageArea();

  assert.deepEqual(await getSettings(sync, runtime), { companyId: "nvidia" });
  assert.deepEqual(await saveSettings(sync, runtime, { companyId: "tsmc" }), { companyId: "tsmc" });
  assert.deepEqual(await getSettings(sync, runtime), { companyId: "tsmc" });
  assert.deepEqual(await saveSettings(sync, runtime, { companyId: "not-real" }), { companyId: "nvidia" });

  await saveQuotes(local, runtime, {
    tsmc: {
      price: 900,
      currency: "TWD",
      updatedAt: "2026-06-02T10:00:00.000Z",
      source: "test"
    }
  });

  assert.equal((await getQuotes(local, runtime)).tsmc.price, 900);
});

class MemoryStorageArea {
  #values = {};

  get(keys, callback) {
    if (typeof keys === "string") {
      callback(Object.hasOwn(this.#values, keys) ? { [keys]: this.#values[keys] } : {});
      return;
    }

    callback({ ...this.#values });
  }

  set(items, callback) {
    this.#values = { ...this.#values, ...items };
    callback();
  }
}
