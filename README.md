# Numakers Browser Extension

Chrome-compatible Manifest V3 extension for `https://india.numakers.com/products/*`.

## What it does

- Leaves the original product price untouched.
- Adds a more prominent GST-inclusive price display next to the existing price.
- Adds a `+18% GST Extra` note at each configured price location.
- Runs only on product detail pages.
- Makes cosmetic changes only.

## Current status

The extension is scaffolded and ready, but the exact Shopify DOM selectors still need to be filled in.

Edit the `PRICE_LOCATIONS` array in `content.js` and set:

- `containerSelector`: The parent node around each price area.
- `priceSelector`: The element containing the original price text.
- `insertion`: Where the cosmetic GST block should be inserted relative to the container.

## Planned four locations

The code is prepared for four price areas:

1. Main product price
2. Bulk discount slab 1
3. Bulk discount slab 2
4. Bulk discount slab 3

If the page actually has the base price plus four bulk slabs, we can expand the array to five entries in a few seconds.

## Load locally in Chrome

1. Open `chrome://extensions`
2. Enable Developer mode
3. Click Load unpacked
4. Select this folder

## Notes

- The content script uses a `MutationObserver` so it can survive Shopify section rerenders.
- Duplicate UI injection is prevented with a custom data attribute marker.
- Price parsing currently supports `Rs.`, `INR`, and rupee-symbol formats.
