import { QUOTE_CACHE_KEY, normalizeQuoteMap } from "./quotes.js";
import { findStock, normalizeStockList } from "./stocks.js";

export const SETTINGS_KEY = "stockSelectionCalculator:settings";
export const STOCK_LIST_KEY = "stockSelectionCalculator:stockList";

export function normalizeSettings(value, stocks = normalizeStockList()) {
  const selectedStockId = value?.selectedStockId;

  return {
    selectedStockId: findStock(stocks, selectedStockId).id
  };
}

export async function getSettings(storageLocal, runtime) {
  const result = await storageGet(storageLocal, runtime, [SETTINGS_KEY, STOCK_LIST_KEY]);
  const stocks = normalizeStockList(result[STOCK_LIST_KEY]);
  return normalizeSettings(result[SETTINGS_KEY], stocks);
}

export async function saveSettings(storageLocal, runtime, settings) {
  const stocks = await getStockList(storageLocal, runtime);
  const normalized = normalizeSettings(settings, stocks);
  await storageSet(storageLocal, runtime, { [SETTINGS_KEY]: normalized });
  return normalized;
}

export async function getStockList(storageLocal, runtime) {
  const result = await storageGet(storageLocal, runtime, STOCK_LIST_KEY);
  return normalizeStockList(result[STOCK_LIST_KEY]);
}

export async function saveStockList(storageLocal, runtime, stocks) {
  const normalized = normalizeStockList(stocks);
  await storageSet(storageLocal, runtime, { [STOCK_LIST_KEY]: normalized });
  return normalized;
}

export async function getQuotes(storageLocal, runtime) {
  const result = await storageGet(storageLocal, runtime, QUOTE_CACHE_KEY);
  return normalizeQuoteMap(result[QUOTE_CACHE_KEY]);
}

export async function saveQuotes(storageLocal, runtime, quotes) {
  const normalized = normalizeQuoteMap(quotes);
  await storageSet(storageLocal, runtime, { [QUOTE_CACHE_KEY]: normalized });
  return normalized;
}

export function storageGet(storageArea, runtime, keys) {
  return invokeStorage(runtime, (done) => storageArea.get(keys, done));
}

export function storageSet(storageArea, runtime, items) {
  return invokeStorage(runtime, (done) => storageArea.set(items, done));
}

function invokeStorage(runtime, invoke) {
  return new Promise((resolve, reject) => {
    try {
      invoke((result) => {
        const message = runtime?.lastError?.message;
        if (message) {
          reject(new Error(message));
          return;
        }

        resolve(result || {});
      });
    } catch (error) {
      reject(error);
    }
  });
}
