export const DEFAULT_COMPANY_ID = "nvidia";

export const COMPANIES = Object.freeze({
  nvidia: Object.freeze({
    id: "nvidia",
    name: "NVIDIA",
    symbol: "NVDA",
    currency: "USD",
    market: "US",
    lotSize: 1
  }),
  mediatek: Object.freeze({
    id: "mediatek",
    name: "MediaTek",
    symbol: "2454.TW",
    currency: "TWD",
    market: "TW",
    lotSize: 1000
  }),
  tsmc: Object.freeze({
    id: "tsmc",
    name: "TSMC",
    symbol: "2330.TW",
    currency: "TWD",
    market: "TW",
    lotSize: 1000
  })
});

export function listCompanies() {
  return Object.values(COMPANIES);
}

export function getCompany(companyId = DEFAULT_COMPANY_ID) {
  return COMPANIES[companyId] || COMPANIES[DEFAULT_COMPANY_ID];
}

export function isKnownCompanyId(companyId) {
  return Object.hasOwn(COMPANIES, companyId);
}

export function formatCurrencyCode(currency) {
  return currency === "TWD" ? "NTD" : currency;
}
