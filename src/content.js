if (!globalThis.__stockSelectionCalculatorLoaded) {
  globalThis.__stockSelectionCalculatorLoaded = true;

  const overlay = document.createElement("div");
  overlay.id = "stock-selection-calculator-overlay";
  overlay.hidden = true;
  document.documentElement.append(overlay);

  let activeRequestId = 0;
  let hideTimer = null;

  document.addEventListener("mouseup", () => {
    window.setTimeout(handleSelection, 0);
  });

  document.addEventListener("keyup", (event) => {
    if (event.key === "Escape") {
      hideOverlay();
      return;
    }

    window.setTimeout(handleSelection, 0);
  });

  document.addEventListener("selectionchange", () => {
    const selection = window.getSelection();
    if (!selection || selection.isCollapsed) {
      hideOverlay();
    }
  });

  document.addEventListener("scroll", hideOverlay, { passive: true });

  async function handleSelection() {
    const selection = window.getSelection();
    if (!selection || selection.isCollapsed || selection.rangeCount === 0) {
      hideOverlay();
      return;
    }

    const amount = parseSelectedAmount(selection.toString());
    if (amount === null) {
      hideOverlay();
      return;
    }

    const rect = getSelectionRect(selection);
    if (!rect) {
      hideOverlay();
      return;
    }

    const requestId = ++activeRequestId;
    showOverlay(rect, "Calculating...");

    try {
      const response = await chrome.runtime.sendMessage({ type: "calculate-selection", amount });
      if (requestId !== activeRequestId) {
        return;
      }

      if (!response?.ok) {
        throw new Error(response?.error || "Unable to calculate shares.");
      }

      showOverlay(rect, buildResultMarkup(response));
      scheduleHide();
    } catch (error) {
      if (requestId === activeRequestId) {
        showOverlay(rect, escapeHtml(error.message));
        scheduleHide();
      }
    }
  }

  function getSelectionRect(selection) {
    const range = selection.getRangeAt(0);
    const rects = Array.from(range.getClientRects()).filter((rect) => rect.width > 0 && rect.height > 0);
    return rects[0] || null;
  }

  function showOverlay(rect, html) {
    window.clearTimeout(hideTimer);
    overlay.hidden = false;
    overlay.innerHTML = html;

    const top = Math.max(8, window.scrollY + rect.top - overlay.offsetHeight - 10);
    const left = Math.min(
      window.scrollX + rect.left,
      window.scrollX + document.documentElement.clientWidth - overlay.offsetWidth - 8
    );

    overlay.style.top = `${top}px`;
    overlay.style.left = `${Math.max(8, left)}px`;
  }

  function hideOverlay() {
    activeRequestId += 1;
    window.clearTimeout(hideTimer);
    overlay.hidden = true;
  }

  function scheduleHide() {
    window.clearTimeout(hideTimer);
    hideTimer = window.setTimeout(hideOverlay, 7000);
  }

  function buildResultMarkup(response) {
    const company = response.company;
    const quote = response.quote;
    const calculation = response.calculation;

    return `
      <div class="ssc-title">${escapeHtml(company.name)} ${escapeHtml(company.symbol)}</div>
      <div class="ssc-result">${escapeHtml(response.formatted)}</div>
      <div class="ssc-meta">Price ${escapeHtml(quote.currency)} ${escapeHtml(String(quote.price))} · Updated ${escapeHtml(formatTime(quote.updatedAt))}</div>
      <div class="ssc-meta">Selected amount: ${escapeHtml(quote.currency)} ${escapeHtml(String(calculation.amount))}</div>
    `;
  }

  function formatTime(value) {
    return new Intl.DateTimeFormat(undefined, {
      hour: "numeric",
      minute: "2-digit"
    }).format(new Date(value));
  }

  function escapeHtml(value) {
    return String(value)
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function parseSelectedAmount(selectionText) {
    if (typeof selectionText !== "string") {
      return null;
    }

    const normalized = selectionText
      .replace(/\u00a0/g, " ")
      .trim()
      .replace(/^[\s$NTDUSD元新台幣台幣]+|[\s$NTDUSD元新台幣台幣]+$/gi, "")
      .trim();

    if (!normalized || normalized.includes("-")) {
      return null;
    }

    if (!/^\d{1,3}(?:,\d{3})*(?:\.\d+)?$|^\d+(?:\.\d+)?$/.test(normalized)) {
      return null;
    }

    const amount = Number(normalized.replaceAll(",", ""));
    return Number.isFinite(amount) && amount > 0 ? amount : null;
  }
}
