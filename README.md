# Money to Shares Chrome Extension

A dependency-free Manifest V3 Chrome extension that converts selected NTD amounts into purchasable shares for a custom local list of Taiwan stocks and ETFs.

## Behavior

- Click the extension icon on an `http` or `https` page to enable the calculator for that page.
- Add Taiwan stock or ETF codes in the popup. Codes must be 4 to 6 digits, such as `2330`, `0050`, or `00878`.
- The extension stores your custom list and selected stock in `chrome.storage.local`.
- Select a single number on the enabled page.
- The extension reads your selected Taiwan stock from the popup.
- A floating result appears next to the selection with the latest cached stock price and computed shares.
- Taiwan stocks display both total shares and lots/shares, where one lot is 1,000 shares.
- New installs default to `2330.TW` and `2454.TW`; users can remove or replace them.

## Load in Chrome

1. Open `chrome://extensions`.
2. Enable **Developer mode**.
3. Click **Load unpacked**.
4. Select this folder: `/Users/awei/Documents/GitHub/Money-to-Shares`.

## Development

```sh
npm test
npm run check
```

The extension uses only browser and Node built-ins, so no install step is required for the current code.

## Icon

The extension icon is generated from `/Users/awei/Downloads/Money-to-Shares.png` into `16`, `32`, `48`, and `128` pixel PNG assets under `icons/`. The manifest uses those assets for both extension metadata and the Chrome toolbar action.

The MVP uses Yahoo Finance's unofficial chart endpoint directly from the extension. For production distribution, replace the quote adapter with a backend proxy or official market data provider.

For Chrome Web Store permission review, the extension does not declare broad `content_scripts` matches. It injects page logic only after the user clicks the extension icon, using Chrome's `activeTab` and `scripting` permissions.
