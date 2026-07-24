import { formatPrice } from "./core/calculator.js";
import { addStockToList, removeStockFromList } from "./core/stocks.js";
import { getQuotes, getSettings, getStockList, saveSettings, saveStockList } from "./core/storage.js";

const stockSelect = document.querySelector("#stockSelect");
const addStockForm = document.querySelector("#addStockForm");
const stockCodeInput = document.querySelector("#stockCodeInput");
const addStockButton = document.querySelector("#addStockButton");
const quotePanel = document.querySelector("#quotePanel");
const status = document.querySelector("#status");
const refreshButton = document.querySelector("#refreshButton");
const optionsButton = document.querySelector("#optionsButton");

let stocks = [];
let settings = { selectedStockId: "" };

init();

async function init() {
  setBusy(true);

  try {
    await loadState();
    await render();
    await enableCurrentPage();
  } catch (error) {
    setStatus(error.message);
  } finally {
    setBusy(false);
  }
}

stockSelect.addEventListener("change", async () => {
  setBusy(true);
  try {
    settings = await saveSettings(chrome.storage.local, chrome.runtime, { selectedStockId: stockSelect.value });
    await render();
    setStatus(`Selected ${settings.selectedStockId}`);
  } catch (error) {
    setStatus(error.message);
  } finally {
    setBusy(false);
  }
});

addStockForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  setBusy(true);
  try {
    const result = addStockToList(stocks, stockCodeInput.value);
    if (!result.added) {
      setStatus(result.reason === "duplicate" ? "Stock already exists" : "Enter 4 to 6 digits");
      return;
    }

    stocks = await saveStockList(chrome.storage.local, chrome.runtime, result.stocks);
    settings = await saveSettings(chrome.storage.local, chrome.runtime, { selectedStockId: result.stock.id });
    stockCodeInput.value = "";
    await render();
    setStatus(`Added ${result.stock.symbol}`);
  } catch (error) {
    setStatus(error.message);
  } finally {
    setBusy(false);
  }
});

refreshButton.addEventListener("click", async () => {
  setBusy(true);
  try {
    const response = await chrome.runtime.sendMessage({ type: "refresh-quotes" });
    if (!response?.ok) {
      throw new Error(response?.error || "Unable to refresh prices.");
    }

    await renderQuotes();
    setStatus("Prices refreshed");
  } catch (error) {
    setStatus(error.message);
  } finally {
    setBusy(false);
  }
});

optionsButton.addEventListener("click", () => {
  chrome.runtime.openOptionsPage();
});

async function enableCurrentPage() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab?.id || !isInjectableUrl(tab.url)) {
    throw new Error("Open an http or https page, then click the extension icon to enable it.");
  }

  await chrome.scripting.insertCSS({
    target: { tabId: tab.id },
    files: ["src/content.css"]
  });
  await chrome.scripting.executeScript({
    target: { tabId: tab.id },
    files: ["src/content.js"]
  });
  setStatus("Enabled on this page");
}

function isInjectableUrl(url) {
  return typeof url === "string" && (url.startsWith("http://") || url.startsWith("https://"));
}

async function loadState() {
  [stocks, settings] = await Promise.all([
    getStockList(chrome.storage.local, chrome.runtime),
    getSettings(chrome.storage.local, chrome.runtime)
  ]);
}

async function render() {
  await renderStockOptions();
  await renderQuotes();
}

async function renderStockOptions() {
  stockSelect.replaceChildren(
    ...stocks.map((stock) => {
      const option = document.createElement("option");
      option.value = stock.id;
      option.textContent = stock.symbol;
      return option;
    })
  );
  stockSelect.value = settings.selectedStockId;
}

async function renderQuotes() {
  const quotes = await getQuotes(chrome.storage.local, chrome.runtime);
  quotePanel.replaceChildren(
    ...stocks.map((stock) => {
      const quote = quotes[stock.id];
      const row = document.createElement("div");
      row.className = "quote-row";

      const left = document.createElement("div");
      const name = document.createElement("div");
      const meta = document.createElement("div");
      const price = document.createElement("div");
      const removeButton = document.createElement("button");

      name.className = "quote-name";
      meta.className = "quote-meta";
      price.className = "quote-price";
      removeButton.className = "remove-button";
      removeButton.type = "button";
      removeButton.dataset.stockId = stock.id;
      name.textContent = stock.symbol === settings.selectedStockId ? `${stock.symbol} (selected)` : stock.symbol;
      meta.textContent = quote ? formatDate(quote.updatedAt) : "Not loaded";
      price.textContent = quote ? `${quote.currency} ${formatPrice(quote.price)}` : "--";
      removeButton.textContent = "Remove";

      left.append(name, meta);
      row.append(left, price, removeButton);
      return row;
    })
  );
}

quotePanel.addEventListener("click", async (event) => {
  const button = event.target.closest(".remove-button");
  if (!button) {
    return;
  }

  setBusy(true);
  try {
    const result = removeStockFromList(stocks, button.dataset.stockId, settings.selectedStockId);
    stocks = await saveStockList(chrome.storage.local, chrome.runtime, result.stocks);
    settings = await saveSettings(chrome.storage.local, chrome.runtime, { selectedStockId: result.selectedStockId });
    await render();
    setStatus(`Removed ${button.dataset.stockId}`);
  } catch (error) {
    setStatus(error.message);
  } finally {
    setBusy(false);
  }
});

function setBusy(isBusy) {
  stockSelect.disabled = isBusy;
  stockCodeInput.disabled = isBusy;
  addStockButton.disabled = isBusy;
  refreshButton.disabled = isBusy;
  optionsButton.disabled = isBusy;
}

function setStatus(message) {
  status.textContent = message;
}

function formatDate(value) {
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short"
  }).format(new Date(value));
}
