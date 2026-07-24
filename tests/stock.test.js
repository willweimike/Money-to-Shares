import assert from "node:assert/strict";
import test from "node:test";

import { calculateShares, formatCalculation } from "../src/core/calculator.js";
import {
  buildYahooChartUrl,
  fetchStockQuote,
  getCachedQuote,
  normalizeQuoteMap,
  normalizeYahooChartQuote
} from "../src/core/quotes.js";
import { parseSelectedAmount } from "../src/core/selection.js";
import { getSettings, saveSettings, getQuotes, saveQuotes, getStockList, saveStockList } from "../src/core/storage.js";
import {
  DEFAULT_STOCKS,
  addStockToList,
  createTaiwanStock,
  findStock,
  normalizeStockList,
  normalizeTaiwanCode,
  removeStockFromList
} from "../src/core/stocks.js";

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

test("calculateShares handles Taiwan lots", () => {
  const tsmc = createTaiwanStock("2330");
  const tsmcResult = calculateShares(1_500_000, { price: 900, currency: "TWD" }, tsmc);
  assert.deepEqual(
    {
      stockId: tsmcResult.stockId,
      shares: tsmcResult.shares,
      lots: tsmcResult.lots,
      oddLots: tsmcResult.oddLots
    },
    { stockId: "2330.TW", shares: 1666, lots: 1, oddLots: 666 }
  );
  assert.equal(formatCalculation(tsmcResult, tsmc), "1,666 股 (1 張 666 股), NTD 1,500,000 / 900");
});

test("taiwan stock helpers normalize custom numeric codes", () => {
  assert.equal(normalizeTaiwanCode(" 2330 "), "2330");
  assert.equal(normalizeTaiwanCode("00878"), "00878");
  assert.equal(normalizeTaiwanCode("2330.TW"), null);
  assert.equal(normalizeTaiwanCode("abc"), null);
  assert.equal(normalizeTaiwanCode("123"), null);
  assert.equal(normalizeTaiwanCode("1234567"), null);

  assert.deepEqual(createTaiwanStock("0050"), {
    id: "0050.TW",
    code: "0050",
    name: "0050",
    symbol: "0050.TW",
    currency: "TWD",
    market: "TW",
    lotSize: 1000
  });
});

test("custom stock list normalization deduplicates and falls back to defaults", () => {
  assert.deepEqual(DEFAULT_STOCKS.map((stock) => stock.symbol), ["2330.TW", "2454.TW"]);
  assert.deepEqual(
    normalizeStockList(["2330", "0050", "2330", "bad", { code: "00878" }]).map((stock) => stock.symbol),
    ["2330.TW", "0050.TW", "00878.TW"]
  );
  assert.deepEqual(normalizeStockList(["bad"]).map((stock) => stock.symbol), ["2330.TW", "2454.TW"]);

  const stocks = normalizeStockList(["2330", "0050"]);
  assert.equal(findStock(stocks, "0050.TW").symbol, "0050.TW");
  assert.equal(findStock(stocks, "missing").symbol, "2330.TW");
});

test("custom stock list operations add and remove with selected fallback", () => {
  const addResult = addStockToList(normalizeStockList(["2330"]), "0050");
  assert.deepEqual(addResult.stocks.map((stock) => stock.symbol), ["2330.TW", "0050.TW"]);
  assert.equal(addResult.added, true);

  const duplicateResult = addStockToList(addResult.stocks, "0050");
  assert.equal(duplicateResult.added, false);
  assert.equal(duplicateResult.reason, "duplicate");

  const invalidResult = addStockToList(addResult.stocks, "2330.TW");
  assert.equal(invalidResult.added, false);
  assert.equal(invalidResult.reason, "invalid");

  const keepSelection = removeStockFromList(addResult.stocks, "0050.TW", "2330.TW");
  assert.deepEqual(keepSelection.stocks.map((stock) => stock.symbol), ["2330.TW"]);
  assert.equal(keepSelection.selectedStockId, "2330.TW");

  const fallbackSelection = removeStockFromList(addResult.stocks, "0050.TW", "0050.TW");
  assert.equal(fallbackSelection.selectedStockId, "2330.TW");

  const restoredDefaults = removeStockFromList(normalizeStockList(["2330"]), "2330.TW", "2330.TW");
  assert.deepEqual(restoredDefaults.stocks.map((stock) => stock.symbol), ["2330.TW", "2454.TW"]);
  assert.equal(restoredDefaults.selectedStockId, "2330.TW");
});

test("calculateShares rejects unusable amounts or prices", () => {
  const stock = createTaiwanStock("2330");
  assert.throws(() => calculateShares(0, { price: 100 }, stock), /Amount/);
  assert.throws(() => calculateShares(1000, { price: 0 }, stock), /Quote price/);
});

test("normalizeYahooChartQuote returns a stable quote", () => {
  const stock = createTaiwanStock("2330");
  const quote = normalizeYahooChartQuote(
    {
      chart: {
        result: [
          {
            meta: {
              regularMarketPrice: 123.45,
              previousClose: 120,
              currency: "TWD"
            }
          }
        ]
      }
    },
    stock,
    new Date("2026-06-02T10:00:00.000Z")
  );

  assert.deepEqual(quote, {
    stockId: "2330.TW",
    symbol: "2330.TW",
    price: 123.45,
    currency: "TWD",
    updatedAt: "2026-06-02T10:00:00.000Z",
    source: "yahoo-chart"
  });
});

test("normalizeYahooChartQuote falls back to previous close and rejects empty payloads", () => {
  const stock = createTaiwanStock("2330");
  const quote = normalizeYahooChartQuote(
    {
      chart: {
        result: [{ meta: { previousClose: 88, currency: "TWD" } }]
      }
    },
    stock,
    new Date("2026-06-02T10:00:00.000Z")
  );
  assert.equal(quote.price, 88);
  assert.throws(() => normalizeYahooChartQuote({}, stock), /No usable quote/);
});

test("fetchStockQuote calls the Yahoo chart URL and handles HTTP errors", async () => {
  const stock = createTaiwanStock("2454");
  const fetchOk = async (url) => {
    assert.equal(url, buildYahooChartUrl(stock.symbol));
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

  const quote = await fetchStockQuote(stock, fetchOk, new Date("2026-06-02T10:00:00.000Z"));
  assert.equal(quote.symbol, "2454.TW");
  assert.equal(quote.price, 1200);

  await assert.rejects(
    () => fetchStockQuote(stock, async () => ({ ok: false, status: 429 }), new Date()),
    /HTTP 429/
  );
});

test("getCachedQuote respects ttl and normalizeQuoteMap removes invalid entries", () => {
  const now = Date.parse("2026-06-02T10:05:00.000Z");
  const quotes = normalizeQuoteMap({
    "2330.TW": {
      price: 100,
      currency: "TWD",
      updatedAt: "2026-06-02T10:04:00.000Z",
      source: "test"
    },
    unknown: {
      price: 1
    },
    "0050.TW": {
      price: 0
    }
  });

  assert.equal(getCachedQuote(quotes, "2330.TW", now)?.price, 100);
  assert.equal(getCachedQuote(quotes, "2330.TW", now + 10 * 60 * 1000), null);
  assert.deepEqual(Object.keys(quotes), ["2330.TW"]);
});

test("quotes round trip through storage wrappers", async () => {
  const runtime = { lastError: null };
  const local = new MemoryStorageArea();

  await saveQuotes(local, runtime, {
    "2330.TW": {
      price: 900,
      currency: "TWD",
      updatedAt: "2026-06-02T10:00:00.000Z",
      source: "test"
    }
  });

  assert.equal((await getQuotes(local, runtime))["2330.TW"].price, 900);
});

test("stock list and selected stock settings round trip through local storage wrappers", async () => {
  const runtime = { lastError: null };
  const local = new MemoryStorageArea();

  assert.deepEqual((await getStockList(local, runtime)).map((stock) => stock.symbol), ["2330.TW", "2454.TW"]);
  assert.deepEqual((await getSettings(local, runtime)).selectedStockId, "2330.TW");

  await saveStockList(local, runtime, ["0050", "00878", "0050", "bad"]);
  assert.deepEqual((await getStockList(local, runtime)).map((stock) => stock.symbol), ["0050.TW", "00878.TW"]);

  assert.deepEqual(await saveSettings(local, runtime, { selectedStockId: "00878.TW" }), {
    selectedStockId: "00878.TW"
  });
  assert.deepEqual(await saveSettings(local, runtime, { selectedStockId: "missing" }), {
    selectedStockId: "0050.TW"
  });
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
