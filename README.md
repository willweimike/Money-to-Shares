# Money to Shares Chrome Extension

A dependency-free Manifest V3 Chrome extension that converts selected money amounts into purchasable shares for NVIDIA, MediaTek, and TSMC.

## Behavior

- Click the extension icon on an `http` or `https` page to enable the calculator for that page.
- Select a single number on the enabled page.
- The extension reads your selected company preference from the popup.
- A floating result appears next to the selection with the latest cached stock price and computed shares.
- NVIDIA uses `NVDA` in USD. MediaTek uses `2454.TW` in TWD. TSMC uses `2330.TW` in TWD.
- Taiwan stocks display both total shares and lots/shares, where one lot is 1,000 shares.

## Load in Chrome

1. Open `chrome://extensions`.
2. Enable **Developer mode**.
3. Click **Load unpacked**.
4. Select this folder: `path/to/chrome-extension`.

## Development

```sh
npm test
npm run check
```

The extension uses only browser and Node built-ins, so no install step is required for the current code.

The MVP uses Yahoo Finance's unofficial chart endpoint directly from the extension. For production distribution, replace the quote adapter with a backend proxy or official market data provider.

For Chrome Web Store permission review, the extension does not declare broad `content_scripts` matches. It injects page logic only after the user clicks the extension icon, using Chrome's `activeTab` and `scripting` permissions.
