const CART_GST_RATE = 0.18;
const CART_REFRESH_DELAY_MS = 150;
const CART_ITEM_MARKER = "data-numakers-cart-gst-item";
const CART_SUMMARY_MARKER = "data-numakers-cart-gst-summary";
const CART_SHIPPING_MARKER = "data-numakers-cart-gst-shipping";
const CART_DRAWER_SELECTOR = "#shopify-section-cart-drawer";
const CART_PAGE_SELECTOR = '[data-cart-wrapper]';
const CART_PAGE_HEADER_MARKER = "data-numakers-cart-gst-head";
const CART_PAGE_CELL_MARKER = "data-numakers-cart-gst-cell";
const CART_LABELS = {
  itemInclusiveLabel: "Item cost",
  itemLineTotalLabel: "Total (incl. GST)",
  summaryInclusiveLabel: "Total (incl. GST)",
  shippingMessage: "Shipping will be extra at checkout, and shipping charges will attract an additional 18% GST.",
  pageSubtotalLabel: "Subtotal",
  pageTotalLabel: "Total"
};

let cartRefreshTimer = null;
let suppressCartObserver = false;
let lastCartUrl = window.location.href;

function parseCartPrice(text) {
  if (!text) return null;

  const cleaned = text.replace(/,/g, "");
  const match = cleaned.match(/(?:Rs\.?|INR|\u20B9)\s*([0-9]+(?:\.[0-9]+)?)/i)
    || cleaned.match(/([0-9]+(?:\.[0-9]+)?)/);

  if (!match) {
    return null;
  }

  const value = Number.parseFloat(match[1]);
  return Number.isFinite(value) ? value : null;
}

function formatCartPrice(value) {
  return `Rs. ${new Intl.NumberFormat("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(value)}`;
}

function normalizeCartText(text) {
  return (text || "").replace(/\s+/g, " ").trim();
}

function isNodeVisible(node) {
  if (!(node instanceof HTMLElement)) {
    return false;
  }

  if (node.hidden) {
    return false;
  }

  const style = window.getComputedStyle(node);
  return style.display !== "none" && style.visibility !== "hidden";
}

function getQuantityFromItem(item) {
  const quantityInput = item.querySelector('input[name="updates[]"]');

  if (!quantityInput) {
    return 1;
  }

  const quantity = Number.parseInt(quantityInput.value || quantityInput.getAttribute("value") || "1", 10);
  return Number.isFinite(quantity) && quantity > 0 ? quantity : 0;
}

function findCurrentPriceNode(item) {
  const preferredSelectors = [".scd-item__price--discount", ".scd-item__price"];

  for (const selector of preferredSelectors) {
    const matches = Array.from(item.querySelectorAll(selector));
    const match = matches.find((node) => {
      if (!(node instanceof HTMLElement) || !isNodeVisible(node)) {
        return false;
      }

      if (node.closest("del")) {
        return false;
      }

      const text = normalizeCartText(node.textContent);
      return parseCartPrice(text) !== null;
    });

    if (match) {
      return match;
    }
  }

  return null;
}

function findPriceMount(item, priceNode) {
  if (!priceNode) {
    return null;
  }

  return item.querySelector(".scd-item__prices") || priceNode.closest(".scd-item__prices");
}

function getCartItemsWithin(scope) {
  const uniqueItems = new Set();
  scope.querySelectorAll("[data-cart-item]").forEach((item) => {
    if (!(item instanceof HTMLElement)) {
      return;
    }

    if (!item.querySelector('input[name="updates[]"]')) {
      return;
    }

    uniqueItems.add(item);
  });

  return Array.from(uniqueItems);
}

function getCartContexts() {
  const contexts = [];
  const drawer = document.querySelector(CART_DRAWER_SELECTOR);
  const page = window.location.pathname.startsWith("/cart")
    ? document.querySelector(CART_PAGE_SELECTOR)
    : null;

  if (drawer instanceof HTMLElement && getCartItemsWithin(drawer).length > 0) {
    contexts.push({ kind: "drawer", root: drawer });
  }

  if (page instanceof HTMLElement && getCartItemsWithin(page).length > 0) {
    contexts.push({ kind: "page", root: page });
  }

  return contexts;
}

function buildItemEnhancement(unitPriceWithGst, lineTotalWithGst) {
  const block = document.createElement("div");
  block.className = "numakers-cart-gst-item numakers-gst-roundbox";
  block.setAttribute(CART_ITEM_MARKER, "true");

  const unitRow = document.createElement("div");
  unitRow.className = "numakers-cart-gst-item-row";
  unitRow.innerHTML = `<span>${CART_LABELS.itemInclusiveLabel}</span><strong>${formatCartPrice(unitPriceWithGst)}</strong>`;

  const totalRow = document.createElement("div");
  totalRow.className = "numakers-cart-gst-item-row";
  totalRow.innerHTML = `<span>${CART_LABELS.itemLineTotalLabel}</span><strong>${formatCartPrice(lineTotalWithGst)}</strong>`;

  block.append(unitRow, totalRow);
  return block;
}

function buildPageValueNode(value) {
  const wrapper = document.createElement("div");
  wrapper.className = "sf-cart__item-discount-prices";

  const finalPrice = document.createElement("p");
  finalPrice.className = "sf-cart__item--final-price";

  const label = document.createElement("span");
  label.className = "visually-hidden";
  label.textContent = "GST total";

  const amount = document.createElement("span");
  amount.className = "order-discount";
  amount.textContent = formatCartPrice(value);

  finalPrice.append(label, amount);
  wrapper.append(finalPrice);
  return wrapper;
}

function getExistingItemEnhancement(item) {
  const blocks = Array.from(item.querySelectorAll(`[${CART_ITEM_MARKER}="true"]`));
  const [primaryBlock, ...duplicateBlocks] = blocks;

  duplicateBlocks.forEach((block) => block.remove());

  return primaryBlock || null;
}

function getExistingPageCell(item) {
  const cells = Array.from(item.querySelectorAll(`[${CART_PAGE_CELL_MARKER}="true"]`));
  const [primaryCell, ...duplicateCells] = cells;

  duplicateCells.forEach((cell) => cell.remove());

  return primaryCell || null;
}

function syncItemEnhancement(item) {
  const priceNode = findCurrentPriceNode(item);
  if (!priceNode) {
    return null;
  }

  const unitPrice = parseCartPrice(priceNode.textContent);
  if (unitPrice === null) {
    return null;
  }

  const quantity = getQuantityFromItem(item);
  const unitPriceWithGst = unitPrice * (1 + CART_GST_RATE);
  const lineTotalWithGst = unitPriceWithGst * quantity;
  const mount = findPriceMount(item, priceNode);

  if (!mount) {
    return null;
  }

  let block = getExistingItemEnhancement(item);
  if (!block) {
    block = buildItemEnhancement(unitPriceWithGst, lineTotalWithGst);
    mount.before(block);
  } else {
    if (block.nextElementSibling !== mount) {
      mount.before(block);
    }

    const nextBlock = buildItemEnhancement(unitPriceWithGst, lineTotalWithGst);
    block.replaceChildren(...nextBlock.childNodes);
  }

  return lineTotalWithGst;
}

function findPageSubtotalCell(item) {
  return item.querySelector(".sf-cart__table-subtotal");
}

function findPageLineTotalNode(item) {
  const selectors = [
    "[data-cart-item-final-price]",
    ".scd-item__original_line_price[data-cart-item-original-price]",
    "[data-cart-item-original-price]"
  ];

  for (const selector of selectors) {
    const matches = Array.from(item.querySelectorAll(selector));
    const match = matches.find((node) => {
      if (!(node instanceof HTMLElement) || !isNodeVisible(node)) {
        return false;
      }

      const text = normalizeCartText(node.textContent);
      return parseCartPrice(text) !== null;
    });

    if (match) {
      return match;
    }
  }

  return null;
}

function sanitizeClonedCartNode(node) {
  if (!(node instanceof HTMLElement)) {
    return;
  }

  const attributes = [
    "data-cart-subtotal",
    "data-cart-subtotal-price",
    "data-cart-item-final-price",
    "data-cart-item-original-price"
  ];

  attributes.forEach((attribute) => {
    node.removeAttribute(attribute);
  });

  node.querySelectorAll(
    "[data-cart-subtotal], [data-cart-subtotal-price], [data-cart-item-final-price], [data-cart-item-original-price]"
  ).forEach((child) => {
    attributes.forEach((attribute) => {
      child.removeAttribute(attribute);
    });
  });
}

function ensurePageHeader(root) {
  const tableHead = root.querySelector(".sf-cart__table-head");
  const subtotalHead = tableHead?.querySelector(".sf-cart__table-subtotal");
  if (!(tableHead instanceof HTMLElement) || !(subtotalHead instanceof HTMLElement)) {
    return;
  }

  subtotalHead.textContent = CART_LABELS.pageSubtotalLabel;

  let gstHead = tableHead.querySelector(`[${CART_PAGE_HEADER_MARKER}="true"]`);
  if (!gstHead) {
    gstHead = subtotalHead.cloneNode(true);
    gstHead.setAttribute(CART_PAGE_HEADER_MARKER, "true");
    subtotalHead.insertAdjacentElement("afterend", gstHead);
  }

  subtotalHead.classList.add("numakers-accent");
  gstHead.textContent = CART_LABELS.pageTotalLabel;
}

function syncPageItemCell(item) {
  const subtotalCell = findPageSubtotalCell(item);
  const lineTotalNode = findPageLineTotalNode(item);
  if (!(subtotalCell instanceof HTMLElement) || !(lineTotalNode instanceof HTMLElement)) {
    return null;
  }

  const lineTotal = parseCartPrice(lineTotalNode.textContent);
  if (lineTotal === null) {
    return null;
  }

  const lineTotalWithGst = lineTotal * (1 + CART_GST_RATE);
  let gstCell = getExistingPageCell(item);

  if (!gstCell) {
    gstCell = subtotalCell.cloneNode(true);
    gstCell.setAttribute(CART_PAGE_CELL_MARKER, "true");
    gstCell.classList.add("numakers-gst-table-value");
    gstCell.classList.add("numakers-accent");
    sanitizeClonedCartNode(gstCell);
    subtotalCell.insertAdjacentElement("afterend", gstCell);
  } else if (gstCell.previousElementSibling !== subtotalCell) {
    subtotalCell.insertAdjacentElement("afterend", gstCell);
  }

  gstCell.replaceChildren(buildPageValueNode(lineTotalWithGst));
  return lineTotalWithGst;
}

function findSummaryValueNode(scope) {
  const match = scope.querySelector("[data-cart-subtotal-price], .scd__subtotal-price, .sf-cart-subtotal__price");
  return match instanceof HTMLElement && isNodeVisible(match) ? match : null;
}

function findSummaryRow(valueNode) {
  if (!valueNode) {
    return null;
  }

  return valueNode.closest("[data-cart-subtotal], .scd__subtotal") || valueNode.parentElement;
}

function findSummaryMount(row) {
  if (!row) {
    return null;
  }

  return row.closest("[data-cart-summary], .scd__summary") || row.parentElement;
}

function ensureSummaryRow(summaryMount, summaryRow, totalWithGst) {
  let gstRow = summaryMount.querySelector(`[${CART_SUMMARY_MARKER}="true"]`);

  if (!gstRow) {
    gstRow = summaryRow.cloneNode(true);
    sanitizeClonedCartNode(gstRow);
    gstRow.classList.add("numakers-cart-gst-summary");
    gstRow.setAttribute(CART_SUMMARY_MARKER, "true");

    if (summaryRow && summaryRow.parentElement) {
      summaryRow.insertAdjacentElement("afterend", gstRow);
    } else {
      summaryMount.append(gstRow);
    }
  }

  const labelNode = gstRow.firstElementChild;
  if (labelNode) {
    labelNode.textContent = CART_LABELS.summaryInclusiveLabel;
  }

  const valueNode = gstRow.querySelector("[data-cart-subtotal-price], .scd__subtotal-price, .sf-cart-subtotal__price");
  if (valueNode instanceof HTMLElement) {
    valueNode.classList.add("numakers-cart-gst-summary-value");
    valueNode.textContent = formatCartPrice(totalWithGst);
  }
}

function ensureShippingNote(summaryMount, summaryRow) {
  let shippingNote = summaryMount.querySelector(`[${CART_SHIPPING_MARKER}="true"]`);

  if (!shippingNote) {
    shippingNote = document.createElement("div");
    shippingNote.className = "numakers-cart-gst-shipping numakers-gst-roundbox";
    shippingNote.setAttribute(CART_SHIPPING_MARKER, "true");
    shippingNote.textContent = CART_LABELS.shippingMessage;
  }

  if (summaryRow && shippingNote.previousElementSibling !== summaryRow) {
    summaryRow.insertAdjacentElement("afterend", shippingNote);
  } else if (!shippingNote.parentElement) {
    summaryMount.append(shippingNote);
  }
}

function syncCartSummary(scope, totalWithGst) {
  const summaryValueNode = findSummaryValueNode(scope);
  if (!summaryValueNode) {
    return;
  }

  const summaryRow = findSummaryRow(summaryValueNode);
  const summaryMount = findSummaryMount(summaryRow);
  if (!summaryMount) {
    return;
  }

  ensureSummaryRow(summaryMount, summaryRow, totalWithGst);
  const gstSummaryRow = summaryMount.querySelector(`[${CART_SUMMARY_MARKER}="true"]`);
  ensureShippingNote(summaryMount, gstSummaryRow);
}

function runCartEnhancements() {
  suppressCartObserver = true;
  const contexts = getCartContexts();

  contexts.forEach((context) => {
    const items = getCartItemsWithin(context.root);
    const totalWithGst = items.reduce((sum, item) => {
      const itemTotal = context.kind === "page"
        ? syncPageItemCell(item)
        : syncItemEnhancement(item);
      return sum + (itemTotal || 0);
    }, 0);

    if (context.kind === "page") {
      ensurePageHeader(context.root);
    }

    if (items.length > 0) {
      syncCartSummary(context.root, totalWithGst);
    }
  });

  window.setTimeout(() => {
    suppressCartObserver = false;
  }, 0);
}

function scheduleCartRefresh() {
  if (cartRefreshTimer !== null) {
    window.clearTimeout(cartRefreshTimer);
  }

  cartRefreshTimer = window.setTimeout(() => {
    cartRefreshTimer = null;
    runCartEnhancements();
  }, CART_REFRESH_DELAY_MS);
}

function handleCartInteraction(event) {
  const target = event.target;
  if (!(target instanceof Element)) {
    return;
  }

  if (!target.closest(`${CART_DRAWER_SELECTOR}, ${CART_PAGE_SELECTOR}`)) {
    return;
  }

  if (
    target.matches('input[name="updates[]"]')
    || target.closest("[data-qty-change], .scd-item__remove")
  ) {
    scheduleCartRefresh();
  }
}

function handleCartUrlChange() {
  if (window.location.href === lastCartUrl) {
    return;
  }

  lastCartUrl = window.location.href;
  scheduleCartRefresh();
}

function wrapCartHistoryMethod(methodName) {
  const originalMethod = history[methodName];

  history[methodName] = function wrappedCartHistoryMethod(...args) {
    const result = originalMethod.apply(this, args);
    handleCartUrlChange();
    return result;
  };
}

const cartObserver = new MutationObserver(() => {
  if (suppressCartObserver) {
    return;
  }

  scheduleCartRefresh();
});

function bootstrapCartEnhancements() {
  runCartEnhancements();

  cartObserver.observe(document.body, {
    childList: true,
    subtree: true,
    characterData: true
  });

  document.addEventListener("input", handleCartInteraction, true);
  document.addEventListener("change", handleCartInteraction, true);
  document.addEventListener("click", handleCartInteraction, true);
  window.addEventListener("popstate", handleCartUrlChange);
  window.addEventListener("hashchange", handleCartUrlChange);

  wrapCartHistoryMethod("pushState");
  wrapCartHistoryMethod("replaceState");
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", bootstrapCartEnhancements, { once: true });
} else {
  bootstrapCartEnhancements();
}
