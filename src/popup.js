import { formatPrice } from "./core/calculator.js";
import { getCompany, listCompanies } from "./core/stocks.js";
import { getQuotes, getSettings, saveSettings } from "./core/storage.js";

const companySelect = document.querySelector("#companySelect");
const quotePanel = document.querySelector("#quotePanel");
const status = document.querySelector("#status");
const refreshButton = document.querySelector("#refreshButton");
const optionsButton = document.querySelector("#optionsButton");

init();

async function init() {
  setBusy(true);
  renderCompanyOptions();

  try {
    const settings = await getSettings(chrome.storage.sync, chrome.runtime);
    companySelect.value = settings.companyId;
    await renderQuotes();
    await enableCurrentPage();
  } catch (error) {
    setStatus(error.message);
  } finally {
    setBusy(false);
  }
}

companySelect.addEventListener("change", async () => {
  setBusy(true);
  try {
    await saveSettings(chrome.storage.sync, chrome.runtime, { companyId: companySelect.value });
    const company = getCompany(companySelect.value);
    setStatus(`Selected ${company.name}`);
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

function renderCompanyOptions() {
  companySelect.replaceChildren(
    ...listCompanies().map((company) => {
      const option = document.createElement("option");
      option.value = company.id;
      option.textContent = `${company.name} (${company.symbol})`;
      return option;
    })
  );
}

async function renderQuotes() {
  const quotes = await getQuotes(chrome.storage.local, chrome.runtime);
  quotePanel.replaceChildren(
    ...listCompanies().map((company) => {
      const quote = quotes[company.id];
      const row = document.createElement("div");
      row.className = "quote-row";

      const left = document.createElement("div");
      const name = document.createElement("div");
      const meta = document.createElement("div");
      const price = document.createElement("div");

      name.className = "quote-name";
      meta.className = "quote-meta";
      price.className = "quote-price";
      name.textContent = company.name;
      meta.textContent = `${company.symbol} · ${quote ? formatDate(quote.updatedAt) : "Not loaded"}`;
      price.textContent = quote ? `${quote.currency} ${formatPrice(quote.price)}` : "--";

      left.append(name, meta);
      row.append(left, price);
      return row;
    })
  );
}

function setBusy(isBusy) {
  companySelect.disabled = isBusy;
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
