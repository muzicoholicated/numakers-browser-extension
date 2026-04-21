# Numakers Browser Extension

Manifest V3 browser extension for `https://india.numakers.com/products/*`.

Author: Prakhar Kumar

Repository: https://github.com/muzicoholicated/numakers-browser-extension

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

## Install locally

### Chrome, Edge, Opera

1. Download or clone this repository.
2. Open the browser's extensions page.
3. Enable Developer mode.
4. Choose Load unpacked.
5. Select this folder.

### Firefox

1. Download or clone this repository.
2. Open `about:debugging#/runtime/this-firefox`.
3. Click Load Temporary Add-on.
4. Select any file inside this folder, such as `manifest.json`.

## GitHub build

GitHub Actions can package the extension for you.

- The workflow creates a distributable `.zip` from the repository contents.
- The `assets/` directory is excluded from the packaged extension.
- On pushes to `main`, the ZIP is available as a workflow artifact.
- On tags like `v0.1.0`, the ZIP is also attached to the GitHub release.

## Recommended distribution

For the least friction, use different channels for Firefox and Chromium browsers:

- Firefox: publish or self-distribute a signed `.xpi` build. Firefox supports signed self-distribution, so users can install from file with much less hassle than Chromium browsers.
- Chrome: if you want normal users to install with one click on Windows or macOS, the practical path is the Chrome Web Store. An unlisted item still works if you only want to share the direct link.
- Edge: users can often install Chromium extensions from the Chrome Web Store after enabling extensions from other stores, but publishing to Microsoft Edge Add-ons is smoother for less technical users.
- Opera: Chromium-compatible packaging works, and users may also install compatible extensions through Opera's extension flow or Chromium-store-compatible routes.

## Notes on self-hosting

- Chrome officially limits direct end-user installs outside the Chrome Web Store on Windows and macOS, except for enterprise-managed setups.
- If you don't want public store discovery, "niche" does not automatically rule out store hosting. An unlisted Chrome Web Store item is often the best compromise between low visibility and easy installation.
- If you want, add a GitHub Releases page with packaged builds and a short browser-by-browser install guide.

## Notes

- The content script uses a `MutationObserver` so it can survive Shopify section rerenders.
- Duplicate UI injection is prevented with a custom data attribute marker.
- Price parsing currently supports `Rs.`, `INR`, and rupee-symbol formats.
