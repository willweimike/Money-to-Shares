import { formatPrice } from "./core/calculator.js";
import { listCompanies } from "./core/stocks.js";
import { getQuotes, getSettings } from "./core/storage.js";

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
    const [settings, quotes] = await Promise.all([
      getSettings(chrome.storage.sync, chrome.runtime),
      getQuotes(chrome.storage.local, chrome.runtime)
    ]);
    render(settings, quotes);
  } catch (error) {
    summary.textContent = error.message;
  }
}

function render(settings, quotes) {
  const selectedCompany = listCompanies().find((company) => company.id === settings.companyId);
  summary.textContent = `Current company: ${selectedCompany.name}`;
  stocksList.replaceChildren(
    ...listCompanies().map((company) => {
      const quote = quotes[company.id];
      const card = document.createElement("article");
      const main = document.createElement("div");
      const title = document.createElement("h2");
      const details = document.createElement("p");
      const time = document.createElement("time");
      const price = document.createElement("div");

      card.className = "note-card";
      main.className = "note-main";
      price.className = "quote-price";

      title.textContent = `${company.name}${settings.companyId === company.id ? " (selected)" : ""}`;
      details.textContent = `${company.symbol} · ${company.currency} · ${
        company.market === "TW" ? "Taiwan stock, 1 lot = 1,000 shares" : "US stock, shares"
      }`;
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
