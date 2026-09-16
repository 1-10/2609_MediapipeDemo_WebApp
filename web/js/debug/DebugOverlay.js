const SECTION_DEFINITIONS = {
  common: [
    ["Camera FPS", "cameraFps"],
    ["Render FPS", "renderFps"],
  ],
  mode1: [
    ["Face inference", "faceInferenceMs", "ms"],
    ["Segmentation inference", "segmentationInferenceMs", "ms"],
    ["Face confidences", "faceConfidences"],
    ["Segmentation threshold", "segmentationThreshold"],
    ["Frame ID", "frameId"],
  ],
  mode2: [
    ["Object detection", "objectDetectionMs", "ms"],
    ["Semantic packet", "semanticPacketBytes", "bytes"],
    ["Prompt length", "promptLength"],
    ["Image generation latency", "imageGenerationLatencyMs", "ms"],
    ["Generator errors", "generatorErrorCount"],
    ["Generated images", "generatedImageCount"],
  ],
};

const SECTION_TITLES = {
  common: "Common",
  mode1: "Mode 1",
  mode2: "Mode 2",
};

/**
 * @param {number} value
 * @returns {string}
 */
function formatNumber(value) {
  return Number.isInteger(value) ? String(value) : value.toFixed(2);
}

/**
 * @param {number | number[]} value
 * @param {string | undefined} unit
 * @returns {string}
 */
function formatValue(value, unit) {
  const formatted = Array.isArray(value)
    ? value.map(formatNumber).join(", ")
    : formatNumber(value);

  return unit ? `${formatted} ${unit}` : formatted;
}

/**
 * @param {string} key
 * @param {Record<string, number | number[] | undefined>} values
 * @returns {HTMLElement}
 */
function createSection(key, values) {
  const section = document.createElement("section");
  const heading = document.createElement("h2");
  const list = document.createElement("dl");

  heading.textContent = SECTION_TITLES[key];
  Object.assign(heading.style, {
    fontSize: "12px",
    margin: "6px 0 2px",
  });
  Object.assign(list.style, {
    display: "grid",
    gridTemplateColumns: "max-content auto",
    gap: "2px 8px",
    margin: "0",
  });

  for (const [label, field, unit] of SECTION_DEFINITIONS[key]) {
    const value = values[field];
    if (value === undefined) continue;

    const term = document.createElement("dt");
    const detail = document.createElement("dd");
    term.textContent = label;
    detail.textContent = formatValue(value, unit);
    detail.style.margin = "0";
    list.append(term, detail);
  }

  section.append(heading, list);
  return section;
}

/**
 * Renders the current debug metrics into a dedicated overlay container.
 *
 * @param {HTMLElement} container
 * @param {import("../../../shared/types.js").DebugMetrics} metrics
 */
export function render(container, metrics) {
  Object.assign(container.style, {
    position: "fixed",
    top: "8px",
    right: "8px",
    zIndex: "1000",
    maxWidth: "min(360px, calc(100vw - 16px))",
    padding: "6px 10px 8px",
    borderRadius: "4px",
    background: "rgba(0, 0, 0, 0.68)",
    color: "#fff",
    font: "11px/1.35 ui-monospace, SFMono-Regular, Menlo, monospace",
    pointerEvents: "none",
  });

  const sections = [createSection("common", metrics.common)];
  if (metrics.mode1) sections.push(createSection("mode1", metrics.mode1));
  if (metrics.mode2) sections.push(createSection("mode2", metrics.mode2));

  container.replaceChildren(...sections);
}
