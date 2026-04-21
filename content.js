const GST_RATE = 0.18;
const GST_WARNING = "+18% GST Extra";
const EXTENSION_MARKER = "data-numakers-gst-enhanced";
const INLINE_NOTE_MARKER = "data-numakers-gst-note";
const PARENT_LAYOUT_CLASS = "numakers-gst-parent";

/*
 * Fill these selector definitions once we inspect the live DOM.
 * Each location represents one price area we want to enhance.
 */
const PRICE_LOCATIONS = [
  {
    id: "primary-price",
    containerSelector: "div.main-product__block.main-product__block-price",
    priceSelector: ".f-price__sale .f-price-item--sale",
    insertionTargetSelector: ".f-price",
    insertion: "beforebegin",
    inlineNoteTargetSelector: ".f-price__sale .f-price-item--sale",
    summaryLabel: "Cost:",
    summarySuffix: " (+ shipping)",
    showBlockNote: false,
    showInlineNote: true
  },
  {
    id: "bulk-slab-1",
    containerSelector: "",
    priceSelector: "",
    insertion: "afterend"
  },
  {
    id: "bulk-slab-2",
    containerSelector: "",
    priceSelector: "",
    insertion: "afterend"
  },
  {
    id: "bulk-slab-3",
    containerSelector: "",
    priceSelector: "",
    insertion: "afterend"
  }
];

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

  const label = document.createElement("span");
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
  block.className = "numakers-gst-enhancement";
  block.setAttribute(EXTENSION_MARKER, "true");

  const gstInclusiveValue = originalPrice * (1 + GST_RATE);
  block.append(createInclusivePrice(gstInclusiveValue, location));

  if (location.showBlockNote !== false) {
    block.append(createBadge(location.blockNoteText || GST_WARNING));
  }

  return block;
}

function addInlineNote(container, location) {
  if (!location.showInlineNote || !location.inlineNoteTargetSelector) {
    return;
  }

  const noteTarget = container.matches(location.inlineNoteTargetSelector)
    ? container
    : container.querySelector(location.inlineNoteTargetSelector);

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

function enhanceLocation(location) {
  if (!location.containerSelector || !location.priceSelector) {
    return;
  }

  const container = document.querySelector(location.containerSelector);
  if (!container) return;

  const priceNode = container.matches(location.priceSelector)
    ? container
    : container.querySelector(location.priceSelector);

  if (!priceNode) return;
  if (container.querySelector(`[${EXTENSION_MARKER}="true"][data-location-id="${location.id}"]`)) {
    return;
  }

  const originalPrice = parsePrice(priceNode.textContent);
  if (originalPrice === null) return;

  const enhancement = buildEnhancementBlock(originalPrice, location);
  enhancement.setAttribute("data-location-id", location.id);

  const insertionTarget = location.insertionTargetSelector
    ? (container.matches(location.insertionTargetSelector)
      ? container
      : container.querySelector(location.insertionTargetSelector))
    : container;

  const target = insertionTarget || container;

  switch (location.insertion) {
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

  tagLayoutParent(enhancement);
  addInlineNote(container, location);
}

function runEnhancements() {
  PRICE_LOCATIONS.forEach(enhanceLocation);
}

const observer = new MutationObserver(() => {
  runEnhancements();
});

function bootstrap() {
  runEnhancements();
  observer.observe(document.body, {
    childList: true,
    subtree: true
  });
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", bootstrap, { once: true });
} else {
  bootstrap();
}
