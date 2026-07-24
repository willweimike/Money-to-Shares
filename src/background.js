import { calculateShares, formatCalculation } from "./core/calculator.js";
import { fetchStockQuote, getCachedQuote, mergeQuoteCache } from "./core/quotes.js";
import { findStock } from "./core/stocks.js";
import { getQuotes, getSettings, getStockList, saveQuotes } from "./core/storage.js";

export function createBackgroundHandlers({
  storageLocal = chrome.storage.local,
  runtime = chrome.runtime,
  fetchImpl = fetch
} = {}) {
  async function handleCalculateSelection(amount) {
    const [stocks, settings] = await Promise.all([getStockList(storageLocal, runtime), getSettings(storageLocal, runtime)]);
    const stock = findStock(stocks, settings.selectedStockId);
    const quote = await getQuoteForStock(stock);
    const calculation = calculateShares(amount, quote, stock);

    return {
      ok: true,
      stock,
      quote,
      calculation,
      formatted: formatCalculation(calculation, stock)
    };
  }

  async function getQuoteForStock(stock) {
    const quotes = await getQuotes(storageLocal, runtime);
    const cachedQuote = getCachedQuote(quotes, stock.id);
    if (cachedQuote) {
      return cachedQuote;
    }

    const quote = await fetchStockQuote(stock, fetchImpl);
    const nextQuotes = mergeQuoteCache(quotes, quote);
    await saveQuotes(storageLocal, runtime, nextQuotes);
    return quote;
  }

  async function refreshAllQuotes() {
    const stocks = await getStockList(storageLocal, runtime);
    const existingQuotes = await getQuotes(storageLocal, runtime);
    let nextQuotes = existingQuotes;

    for (const stock of stocks) {
      const quote = await fetchStockQuote(stock, fetchImpl);
      nextQuotes = mergeQuoteCache(nextQuotes, quote);
    }

    await saveQuotes(storageLocal, runtime, nextQuotes);
    return nextQuotes;
  }

  return {
    handleCalculateSelection,
    refreshAllQuotes
  };
}

const handlers = createBackgroundHandlers();

chrome.runtime.onInstalled.addListener(() => {
  chrome.alarms.create("refresh-quotes", { delayInMinutes: 0.1, periodInMinutes: 5 });
  handlers.refreshAllQuotes().catch(() => {});
});

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === "refresh-quotes") {
    handlers.refreshAllQuotes().catch(() => {});
  }
});

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.type === "calculate-selection") {
    handlers
      .handleCalculateSelection(message.amount)
      .then((payload) => sendResponse(payload))
      .catch((error) => sendResponse({ ok: false, error: error.message }));
    return true;
  }

  if (message?.type === "refresh-quotes") {
    handlers
      .refreshAllQuotes()
      .then((quotes) => sendResponse({ ok: true, quotes }))
      .catch((error) => sendResponse({ ok: false, error: error.message }));
    return true;
  }

  return false;
});
