import { formatPrice } from "./core/calculator.js";
import { getQuotes, getSettings, getStockList } from "./core/storage.js";

const summary = document.querySelector("#summary");
const refreshButton = document.querySelector("#refreshButton");
const stocksList = document.querySelector("#stocksList");

loadAndRender();

refreshButton.addEventListener("click", async () => {
  refreshButton.disabled = true;
  try {
    const response = await chrome.runtime.sendMessage({ type: "refresh-quotes" });
    if (!response?.ok) {
      throw new Error(response?.error || "Unable to refresh prices.");
    }

    await loadAndRender();
  } catch (error) {
    summary.textContent = error.message;
  } finally {
    refreshButton.disabled = false;
  }
});

async function loadAndRender() {
  try {
    const [stocks, settings, quotes] = await Promise.all([
      getStockList(chrome.storage.local, chrome.runtime),
      getSettings(chrome.storage.local, chrome.runtime),
      getQuotes(chrome.storage.local, chrome.runtime)
    ]);
    render(stocks, settings, quotes);
  } catch (error) {
    summary.textContent = error.message;
  }
}

function render(stocks, settings, quotes) {
  summary.textContent = `Selected stock: ${settings.selectedStockId}`;
  stocksList.replaceChildren(
    ...stocks.map((stock) => {
      const quote = quotes[stock.id];
      const card = document.createElement("article");
      const main = document.createElement("div");
      const title = document.createElement("h2");
      const details = document.createElement("p");
      const time = document.createElement("time");
      const price = document.createElement("div");

      card.className = "note-card";
      main.className = "note-main";
      price.className = "quote-price";

      title.textContent = `${stock.symbol}${settings.selectedStockId === stock.id ? " (selected)" : ""}`;
      details.textContent = `${stock.code} · ${stock.currency} · Taiwan stock, 1 lot = 1,000 shares`;
      time.textContent = quote ? `Updated ${formatDate(quote.updatedAt)}` : "No quote cached yet";
      price.textContent = quote ? `${quote.currency} ${formatPrice(quote.price)}` : "--";

      main.append(title, details, time);
      card.append(main, price);
      return card;
    })
  );
}

function formatDate(value) {
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short"
  }).format(new Date(value));
}
