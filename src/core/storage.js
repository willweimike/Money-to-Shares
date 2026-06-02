import { QUOTE_CACHE_KEY, normalizeQuoteMap } from "./quotes.js";
import { DEFAULT_COMPANY_ID, isKnownCompanyId } from "./stocks.js";

export const SETTINGS_KEY = "stockSelectionCalculator:settings";

export function normalizeSettings(value) {
  const companyId = value?.companyId;

  return {
    companyId: isKnownCompanyId(companyId) ? companyId : DEFAULT_COMPANY_ID
  };
}

export async function getSettings(storageSync, runtime) {
  const result = await storageGet(storageSync, runtime, SETTINGS_KEY);
  return normalizeSettings(result[SETTINGS_KEY]);
}

export async function saveSettings(storageSync, runtime, settings) {
  const normalized = normalizeSettings(settings);
  await storageSet(storageSync, runtime, { [SETTINGS_KEY]: normalized });
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
