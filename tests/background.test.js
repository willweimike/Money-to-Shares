import assert from "node:assert/strict";
import test from "node:test";

import { saveSettings, saveStockList } from "../src/core/storage.js";

test("background handlers calculate with the selected custom Taiwan stock", async () => {
  const runtime = { lastError: null };
  const local = new MemoryStorageArea();
  globalThis.chrome = makeChrome(runtime, local);

  const { createBackgroundHandlers } = await import("../src/background.js");
  const handlers = createBackgroundHandlers({ storageLocal: local, runtime, fetchImpl: quoteFetch(50) });

  await saveStockList(local, runtime, ["2330", "0050"]);
  await saveSettings(local, runtime, { selectedStockId: "0050.TW" });

  const result = await handlers.handleCalculateSelection(120_000);

  assert.equal(result.ok, true);
  assert.equal(result.stock.symbol, "0050.TW");
  assert.equal(result.quote.stockId, "0050.TW");
  assert.equal(result.calculation.shares, 2400);
  assert.equal(result.formatted, "2,400 股 (2 張 400 股), NTD 120,000 / 50.00");
});

test("background handlers refresh only the custom stock list", async () => {
  const runtime = { lastError: null };
  const local = new MemoryStorageArea();
  globalThis.chrome = makeChrome(runtime, local);
  const requestedUrls = [];

  const { createBackgroundHandlers } = await import("../src/background.js?refresh-test");
  const handlers = createBackgroundHandlers({
    storageLocal: local,
    runtime,
    fetchImpl: async (url) => {
      requestedUrls.push(url);
      return quoteFetch(900)(url);
    }
  });

  await saveStockList(local, runtime, ["2330", "00878"]);
  const quotes = await handlers.refreshAllQuotes();

  assert.deepEqual(Object.keys(quotes), ["2330.TW", "00878.TW"]);
  assert.deepEqual(
    requestedUrls.map((url) => new URL(url).pathname.split("/").at(-1)),
    ["2330.TW", "00878.TW"]
  );
});

function makeChrome(runtime, local) {
  return {
    alarms: {
      create() {},
      onAlarm: { addListener() {} }
    },
    runtime: {
      ...runtime,
      onInstalled: { addListener() {} },
      onMessage: { addListener() {} }
    },
    storage: { local }
  };
}

function quoteFetch(price) {
  return async () => ({
    ok: true,
    async json() {
      return {
        chart: {
          result: [{ meta: { regularMarketPrice: price, currency: "TWD" } }]
        }
      };
    }
  });
}

class MemoryStorageArea {
  #values = {};

  get(keys, callback) {
    if (typeof keys === "string") {
      callback(Object.hasOwn(this.#values, keys) ? { [keys]: this.#values[keys] } : {});
      return;
    }

    if (Array.isArray(keys)) {
      callback(
        keys.reduce((result, key) => {
          if (Object.hasOwn(this.#values, key)) {
            result[key] = this.#values[key];
          }
          return result;
        }, {})
      );
      return;
    }

    callback({ ...this.#values });
  }

  set(items, callback) {
    this.#values = { ...this.#values, ...items };
    callback();
  }
}
