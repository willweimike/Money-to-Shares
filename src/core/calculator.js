import { formatCurrencyCode } from "./stocks.js";

export function calculateShares(amount, quote, company) {
  if (!Number.isFinite(amount) || amount <= 0) {
    throw new Error("Amount must be greater than zero.");
  }

  if (!quote || !Number.isFinite(quote.price) || quote.price <= 0) {
    throw new Error("Quote price must be greater than zero.");
  }

  const shares = Math.floor(amount / quote.price);
  const lotSize = company?.lotSize || 1;
  const lots = lotSize > 1 ? Math.floor(shares / lotSize) : 0;
  const oddLots = lotSize > 1 ? shares % lotSize : shares;

  return {
    amount,
    price: quote.price,
    shares,
    lots,
    oddLots,
    currency: quote.currency || company.currency,
    stockId: company.id,
    symbol: company.symbol
  };
}

export function formatCalculation(calculation, company) {
  const currency = formatCurrencyCode(calculation.currency || company.currency);
  const amount = formatNumber(calculation.amount);
  const price = formatPrice(calculation.price);

  if ((company?.lotSize || 1) > 1) {
    const lotText = calculation.lots > 0 ? `${formatNumber(calculation.lots)} 張 ` : "";
    return `${formatNumber(calculation.shares)} 股 (${lotText}${formatNumber(calculation.oddLots)} 股), ${currency} ${amount} / ${price}`;
  }

  return `${formatNumber(calculation.shares)} 股, ${currency} ${amount} / ${price}`;
}

export function formatNumber(value) {
  return new Intl.NumberFormat("en-US", {
    maximumFractionDigits: 2
  }).format(value);
}

export function formatPrice(value) {
  return new Intl.NumberFormat("en-US", {
    minimumFractionDigits: value >= 100 ? 0 : 2,
    maximumFractionDigits: value >= 100 ? 2 : 4
  }).format(value);
}
