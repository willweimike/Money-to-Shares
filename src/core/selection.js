const MONEY_SYMBOLS = /^[\s$NTDUSD元新台幣台幣]+|[\s$NTDUSD元新台幣台幣]+$/gi;
const NUMERIC_PATTERN = /^\d{1,3}(?:,\d{3})*(?:\.\d+)?$|^\d+(?:\.\d+)?$/;

export function parseSelectedAmount(selectionText) {
  if (typeof selectionText !== "string") {
    return null;
  }

  const normalized = normalizeSelection(selectionText);
  if (!normalized || normalized.includes("-")) {
    return null;
  }

  if (!NUMERIC_PATTERN.test(normalized)) {
    return null;
  }

  const amount = Number(normalized.replaceAll(",", ""));
  if (!Number.isFinite(amount) || amount <= 0) {
    return null;
  }

  return amount;
}

export function normalizeSelection(selectionText) {
  return selectionText
    .replace(/\u00a0/g, " ")
    .trim()
    .replace(MONEY_SYMBOLS, "")
    .trim();
}
