const GST_RATE = 0.18;
const GST_WARNING = "+18% GST Extra";
const EXTENSION_MARKER = "data-numakers-gst-enhanced";
const INLINE_NOTE_MARKER = "data-numakers-gst-note";
const PARENT_LAYOUT_CLASS = "numakers-gst-parent";
const PRICE_ROW_CLASS = "numakers-gst-price-row";
const REFRESH_DELAY_MS = 120;
const TABLE_MARKER = "data-numakers-gst-table-enhanced";
const GST_COLUMN_CLASS = "numakers-gst-table-value";
const WITHOUT_GST_SUFFIX = " (without GST)";

const PRICE_LOCATIONS = {
  id: "primary-price",
  containerSelector: "div.main-product__block.main-product__block-price",
  priceSelector: [
    ".f-price__sale .f-price-item--sale",
    ".f-price__regular .f-price-item--regular"
  ],
  insertionTargetSelector: ".f-price",
  insertion: "beforebegin",
  inlineNoteTargetSelector: [
    ".f-price__sale .f-price-item--sale",
    ".f-price__regular .f-price-item--regular"
  ],
  summaryLabel: "Cost:",
  summarySuffix: " (+ shipping)",
  showBlockNote: false,
  showInlineNote: true
};

let refreshTimer = null;
let suppressPriceObserver = false;
let lastKnownUrl = window.location.href;
let observedPriceContainers = [];

function parsePrice(text) {
  if (!text) return null;

  const cleaned = text.replace(/,/g, "");
  const match = cleaned.match(/(?:Rs\.?|INR|\u20B9)\s*([0-9]+(?:\.[0-9]+)?)/i)
    || cleaned.match(/([0-9]+(?:\.[0-9]+)?)/);

  if (!match) return null;

  const value = Number.parseFloat(match[1]);
  return Number.isFinite(value) ? value : null;
}

function formatPrice(value) {
  return `Rs. ${new Intl.NumberFormat("en-IN", {
    maximumFractionDigits: 2
  }).format(value)}`;
}

function createBadge(text = GST_WARNING) {
  const badge = document.createElement("div");
  badge.className = "numakers-gst-note";
  badge.textContent = text;
  return badge;
}

function createInclusivePrice(gstInclusiveValue, location) {
  const wrapper = document.createElement("div");
  wrapper.className = "numakers-gst-inclusive";

  const label = document.createElement("strong");
  label.className = "numakers-gst-inclusive-label";
  label.textContent = location.summaryLabel || "Incl. GST:";

  const value = document.createElement("strong");
  value.className = "numakers-gst-inclusive-value";
  value.textContent = `${formatPrice(gstInclusiveValue)}${location.summarySuffix || ""}`;

  wrapper.append(label, value);
  return wrapper;
}

function buildEnhancementBlock(originalPrice, location) {
  const block = document.createElement("div");
  block.className = "numakers-gst-enhancement numakers-gst-roundbox";
  block.setAttribute(EXTENSION_MARKER, "true");
  updateEnhancementBlock(block, originalPrice, location);
  return block;
}

function updateEnhancementBlock(block, originalPrice, location) {
  const gstInclusiveValue = originalPrice * (1 + GST_RATE);
  const content = [createInclusivePrice(gstInclusiveValue, location)];

  if (location.showBlockNote !== false) {
    content.push(createBadge(location.blockNoteText || GST_WARNING));
  }

  block.replaceChildren(...content);
}

function findFirstMatch(container, selectorOrSelectors) {
  if (!selectorOrSelectors) {
    return null;
  }

  const selectors = Array.isArray(selectorOrSelectors)
    ? selectorOrSelectors
    : [selectorOrSelectors];

  for (const selector of selectors) {
    const match = container.matches(selector)
      ? container
      : container.querySelector(selector);

    if (match) {
      return match;
    }
  }

  return null;
}

function addInlineNote(container, location) {
  if (!location.showInlineNote || !location.inlineNoteTargetSelector) {
    return;
  }

  const noteTarget = findFirstMatch(container, location.inlineNoteTargetSelector);
  if (!noteTarget) return;
  if (noteTarget.querySelector(`[${INLINE_NOTE_MARKER}="true"][data-location-id="${location.id}"]`)) {
    return;
  }

  const note = document.createElement("span");
  note.className = "numakers-gst-note";
  note.setAttribute(INLINE_NOTE_MARKER, "true");
  note.setAttribute("data-location-id", location.id);
  note.textContent = location.inlineNoteText || GST_WARNING;
  noteTarget.append(note);
}

function tagLayoutParent(node) {
  if (!node || !node.parentElement) {
    return;
  }

  node.parentElement.classList.add(PARENT_LAYOUT_CLASS);
}

function tagPriceRow(node) {
  if (!node) {
    return;
  }

  node.classList.add(PRICE_ROW_CLASS);
}

function normalizeText(text) {
  return text.replace(/\s+/g, " ").trim();
}

function isQuantityHeader(text) {
  return /^(qty|quantity)$/i.test(normalizeText(text));
}

function isPriceHeader(text) {
  return normalizeText(text).length > 0;
}

function createTableCell(tagName, text, className) {
  const cell = document.createElement(tagName);
  if (className) {
    cell.className = className;
  }

  const paragraph = document.createElement("p");
  paragraph.style.textAlign = "center";
  paragraph.textContent = text;
  cell.append(paragraph);
  return cell;
}

function setCellText(cell, text) {
  const paragraph = cell.querySelector("p");
  if (paragraph) {
    paragraph.textContent = text;
    return;
  }

  cell.textContent = text;
}

function getHeaderLabel(cell) {
  return normalizeText(cell.textContent || "");
}

function hasWithoutGstSuffix(text) {
  return /\(without gst\)$/i.test(normalizeText(text));
}

function syncBulkPricingTables() {
  const tables = document.querySelectorAll(
    '.main-product__block-custom_liquid table:not([' + TABLE_MARKER + '="true"])'
  );

  tables.forEach((table) => {
    const rows = Array.from(table.querySelectorAll("tr"));
    let enhanced = false;

    rows.forEach((row) => {
      const cells = Array.from(row.children).filter((cell) => /^(TD|TH)$/.test(cell.tagName));
      if (cells.length === 1) {
        const colspan = Number.parseInt(cells[0].getAttribute("colspan") || "1", 10);
        if (Number.isFinite(colspan) && colspan >= 2) {
          cells[0].setAttribute("colspan", String(colspan + 1));
          enhanced = true;
        }
        return;
      }

      if (cells.length !== 2) {
        return;
      }

      const [quantityCell, priceCell] = cells;
      const quantityText = normalizeText(quantityCell.textContent || "");
      const priceText = normalizeText(priceCell.textContent || "");

      if (isQuantityHeader(quantityText) && isPriceHeader(priceText)) {
        const originalHeaderLabel = getHeaderLabel(priceCell);
        const gstHeaderCell = createTableCell(
          priceCell.tagName.toLowerCase(),
          originalHeaderLabel
        );
        const baseHeaderLabel = hasWithoutGstSuffix(originalHeaderLabel)
          ? originalHeaderLabel
          : `${originalHeaderLabel}${WITHOUT_GST_SUFFIX}`;

        setCellText(priceCell, baseHeaderLabel);
        priceCell.classList.add(GST_COLUMN_CLASS);
        quantityCell.after(gstHeaderCell);
        enhanced = true;
        return;
      }

      const basePrice = parsePrice(priceText);
      if (!quantityText || basePrice === null) {
        return;
      }

      const gstCell = createTableCell(
        priceCell.tagName.toLowerCase(),
        formatPrice(basePrice * (1 + GST_RATE)),
        GST_COLUMN_CLASS
      );
      quantityCell.after(gstCell);
      enhanced = true;
    });

    if (enhanced) {
      table.setAttribute(TABLE_MARKER, "true");
    }
  });
}

function getEnhancementBlock(location) {
  return document.querySelector(
    `[${EXTENSION_MARKER}="true"][data-location-id="${location.id}"]`
  );
}

function insertEnhancement(target, enhancement, insertion) {
  switch (insertion) {
    case "prepend":
      target.prepend(enhancement);
      break;
    case "append":
      target.append(enhancement);
      break;
    case "beforebegin":
      target.before(enhancement);
      break;
    case "afterbegin":
      target.prepend(enhancement);
      break;
    case "beforeend":
      target.append(enhancement);
      break;
    case "afterend":
    default:
      target.after(enhancement);
      break;
  }
}

function syncLocation(location) {
  if (!location.containerSelector || !location.priceSelector) {
    return;
  }

  const container = document.querySelector(location.containerSelector);
  if (!container) return;

  const priceNode = findFirstMatch(container, location.priceSelector);
  if (!priceNode) return;

  const originalPrice = parsePrice(priceNode.textContent);
  if (originalPrice === null) return;

  const insertionTarget = location.insertionTargetSelector
    ? findFirstMatch(container, location.insertionTargetSelector)
    : container;

  const target = insertionTarget || container;
  let enhancement = getEnhancementBlock(location);

  if (!enhancement || !enhancement.isConnected) {
    enhancement = buildEnhancementBlock(originalPrice, location);
    enhancement.setAttribute("data-location-id", location.id);
    insertEnhancement(target, enhancement, location.insertion);
  } else {
    updateEnhancementBlock(enhancement, originalPrice, location);
  }

  tagLayoutParent(enhancement);
  tagPriceRow(target);
  addInlineNote(container, location);
}

function runEnhancements() {
  suppressPriceObserver = true;
  syncLocation(PRICE_LOCATIONS);
  syncBulkPricingTables();
  window.setTimeout(() => {
    suppressPriceObserver = false;
  }, 0);
}

function scheduleRefresh() {
  if (refreshTimer !== null) {
    window.clearTimeout(refreshTimer);
  }

  refreshTimer = window.setTimeout(() => {
    refreshTimer = null;
    bindPriceContainerObserver();
    runEnhancements();
  }, REFRESH_DELAY_MS);
}

function bindPriceContainerObserver() {
  const priceContainer = PRICE_LOCATIONS.containerSelector
    ? document.querySelector(PRICE_LOCATIONS.containerSelector)
    : null;
  const nextContainers = priceContainer ? [priceContainer] : [];
  const hasSameContainers = nextContainers.length === observedPriceContainers.length
    && nextContainers.every((container, index) => container === observedPriceContainers[index]);

  if (hasSameContainers) {
    return;
  }

  priceObserver.disconnect();
  observedPriceContainers = nextContainers;

  observedPriceContainers.forEach((container) => {
    priceObserver.observe(container, {
      childList: true,
      subtree: true,
      characterData: true
    });
  });
}

function isVariantControl(element) {
  return element.matches(
    [
      'select[name="id"]',
      'input[name="id"]',
      'select[name^="options["]',
      'input[name^="options["]'
    ].join(",")
  );
}

function handleVariantControlChange(event) {
  if (!(event.target instanceof Element) || !isVariantControl(event.target)) {
    return;
  }

  scheduleRefresh();
}

function handleUrlChange() {
  if (window.location.href === lastKnownUrl) {
    return;
  }

  lastKnownUrl = window.location.href;
  scheduleRefresh();
}

function wrapHistoryMethod(methodName) {
  const originalMethod = history[methodName];

  history[methodName] = function wrappedHistoryMethod(...args) {
    const result = originalMethod.apply(this, args);
    handleUrlChange();
    return result;
  };
}

const priceObserver = new MutationObserver(() => {
  if (suppressPriceObserver) {
    return;
  }

  scheduleRefresh();
});

function bootstrap() {
  runEnhancements();
  bindPriceContainerObserver();

  document.addEventListener("change", handleVariantControlChange, true);
  window.addEventListener("popstate", handleUrlChange);
  window.addEventListener("hashchange", handleUrlChange);

  wrapHistoryMethod("pushState");
  wrapHistoryMethod("replaceState");
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", bootstrap, { once: true });
} else {
  bootstrap();
}
