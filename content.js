const GST_RATE = 0.18;
const GST_LABEL = "+18% GST Extra";
const INCLUSIVE_PREFIX = "Incl. GST:";
const EXTENSION_MARKER = "data-numakers-gst-enhanced";

/*
 * Fill these selector definitions once we inspect the live DOM.
 * Each location represents one price area we want to enhance.
 */
const PRICE_LOCATIONS = [
  {
    id: "primary-price",
    containerSelector: "",
    priceSelector: "",
    insertion: "afterend"
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
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 2
  }).format(value);
}

function createBadge() {
  const badge = document.createElement("div");
  badge.className = "numakers-gst-note";
  badge.textContent = GST_LABEL;
  return badge;
}

function createInclusivePrice(gstInclusiveValue) {
  const wrapper = document.createElement("div");
  wrapper.className = "numakers-gst-inclusive";

  const label = document.createElement("span");
  label.className = "numakers-gst-inclusive-label";
  label.textContent = INCLUSIVE_PREFIX;

  const value = document.createElement("strong");
  value.className = "numakers-gst-inclusive-value";
  value.textContent = formatPrice(gstInclusiveValue);

  wrapper.append(label, value);
  return wrapper;
}

function buildEnhancementBlock(originalPrice) {
  const block = document.createElement("div");
  block.className = "numakers-gst-enhancement";
  block.setAttribute(EXTENSION_MARKER, "true");

  const gstInclusiveValue = originalPrice * (1 + GST_RATE);
  block.append(createInclusivePrice(gstInclusiveValue), createBadge());
  return block;
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
  if (container.querySelector(`[${EXTENSION_MARKER}="true"]`)) return;

  const originalPrice = parsePrice(priceNode.textContent);
  if (originalPrice === null) return;

  const enhancement = buildEnhancementBlock(originalPrice);

  switch (location.insertion) {
    case "prepend":
      container.prepend(enhancement);
      break;
    case "append":
      container.append(enhancement);
      break;
    case "beforebegin":
      container.before(enhancement);
      break;
    case "afterbegin":
      container.prepend(enhancement);
      break;
    case "beforeend":
      container.append(enhancement);
      break;
    case "afterend":
    default:
      container.after(enhancement);
      break;
  }
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
