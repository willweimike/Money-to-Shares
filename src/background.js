import { calculateShares, formatCalculation } from "./core/calculator.js";
import { fetchCompanyQuote, getCachedQuote, mergeQuoteCache } from "./core/quotes.js";
import { getCompany, listCompanies } from "./core/stocks.js";
import { getQuotes, getSettings, saveQuotes } from "./core/storage.js";

chrome.runtime.onInstalled.addListener(() => {
  chrome.alarms.create("refresh-quotes", { delayInMinutes: 0.1, periodInMinutes: 5 });
  refreshAllQuotes().catch(() => {});
});

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === "refresh-quotes") {
    refreshAllQuotes().catch(() => {});
  }
});

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.type === "calculate-selection") {
    handleCalculateSelection(message.amount)
      .then((payload) => sendResponse(payload))
      .catch((error) => sendResponse({ ok: false, error: error.message }));
    return true;
  }

  if (message?.type === "refresh-quotes") {
    refreshAllQuotes()
      .then((quotes) => sendResponse({ ok: true, quotes }))
      .catch((error) => sendResponse({ ok: false, error: error.message }));
    return true;
  }

  return false;
});

async function handleCalculateSelection(amount) {
  const settings = await getSettings(chrome.storage.sync, chrome.runtime);
  const company = getCompany(settings.companyId);
  const quote = await getQuoteForCompany(company);
  const calculation = calculateShares(amount, quote, company);

  return {
    ok: true,
    company,
    quote,
    calculation,
    formatted: formatCalculation(calculation, company)
  };
}

async function getQuoteForCompany(company) {
  const quotes = await getQuotes(chrome.storage.local, chrome.runtime);
  const cachedQuote = getCachedQuote(quotes, company.id);
  if (cachedQuote) {
    return cachedQuote;
  }

  const quote = await fetchCompanyQuote(company);
  const nextQuotes = mergeQuoteCache(quotes, quote);
  await saveQuotes(chrome.storage.local, chrome.runtime, nextQuotes);
  return quote;
}

async function refreshAllQuotes() {
  const existingQuotes = await getQuotes(chrome.storage.local, chrome.runtime);
  let nextQuotes = existingQuotes;

  for (const company of listCompanies()) {
    const quote = await fetchCompanyQuote(company);
    nextQuotes = mergeQuoteCache(nextQuotes, quote);
  }

  await saveQuotes(chrome.storage.local, chrome.runtime, nextQuotes);
  return nextQuotes;
}
