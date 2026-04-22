# Numakers Browser Extension

Manifest V3 browser extension for `https://india.numakers.com/*`.

Author: Prakhar Kumar

Repository: https://github.com/muzicoholicated/numakers-browser-extension

## What it does

- Leaves the original product, cart, and drawer prices untouched.
- Adds a more prominent GST-inclusive price display next to the existing product price.
- Adds GST-inclusive cosmetic rows to cart items and cart totals.
- Adds a shipping note that clarifies shipping is extra and will attract 18% GST at checkout.
- Runs across the Numakers storefront while keeping all changes cosmetic.

## Current status

The extension currently has two independent content scripts:

- `content.js` handles product-page GST display and bulk-pricing table enhancement.
- `cart-gst.js` handles the cart page and cart drawer GST display.

Both scripts use `MutationObserver` so they can survive Shopify section rerenders and async cart updates.

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

- All cart and drawer updates are cosmetic only.
- Bulk pricing is respected by reading the currently displayed effective price when a discounted or struck-out price is present.
- Duplicate UI injection is prevented with custom data attribute markers.
- Price parsing currently supports `Rs.`, `INR`, and rupee-symbol formats.
