/**
 * @typedef {import("../../../../shared/types.js").GenerationStatusValue} GenerationStatusValue
 *
 * @typedef {object} ReconstructionState
 * @property {GenerationStatusValue} status
 * @property {string} [imageUrl]
 * @property {string} [errorMessage]
 */

const PLACEHOLDER_TEXT = "Coming soon";
const GENERATING_TEXT = "Generating...";
const GENERIC_ERROR_TEXT = "Semantic reconstruction temporarily unavailable.";

let lastSuccessfulImageUrl = "";

/**
 * Renders the Mode 2 reconstruction pane.
 *
 * @param {HTMLElement} container
 * @param {ReconstructionState} state
 * @returns {void}
 */
export function render(container, state) {
  if (!(container instanceof HTMLElement)) {
    throw new TypeError("ReconstructionRenderer.render requires an HTMLElement container.");
  }

  const status = state?.status ?? "idle";
  const imageUrl = typeof state?.imageUrl === "string" ? state.imageUrl : "";

  if (status === "success" && imageUrl) {
    lastSuccessfulImageUrl = imageUrl;
    renderImage(container, imageUrl);
    return;
  }

  if (status === "generating") {
    renderWithPreviousImage(container, imageUrl || lastSuccessfulImageUrl, GENERATING_TEXT, "status");
    return;
  }

  if (status === "error") {
    const message =
      typeof state?.errorMessage === "string" && state.errorMessage.trim()
        ? state.errorMessage.trim()
        : GENERIC_ERROR_TEXT;
    renderWithPreviousImage(container, imageUrl || lastSuccessfulImageUrl, message, "alert");
    return;
  }

  lastSuccessfulImageUrl = "";
  renderPlaceholder(container);
}

/**
 * @param {HTMLElement} container
 * @param {string} imageUrl
 * @returns {void}
 */
function renderImage(container, imageUrl) {
  container.replaceChildren(createImage(imageUrl));
}

/**
 * @param {HTMLElement} container
 * @param {string} imageUrl
 * @param {string} message
 * @param {"status" | "alert"} role
 * @returns {void}
 */
function renderWithPreviousImage(container, imageUrl, message, role) {
  if (!imageUrl) {
    renderPlaceholder(container, message, role);
    return;
  }

  const frame = document.createElement("div");
  frame.style.position = "relative";
  frame.style.width = "100%";
  frame.style.height = "100%";

  const overlay = document.createElement("p");
  overlay.textContent = message;
  overlay.role = role;
  overlay.style.position = "absolute";
  overlay.style.right = "12px";
  overlay.style.bottom = "12px";
  overlay.style.maxWidth = "calc(100% - 24px)";
  overlay.style.margin = "0";
  overlay.style.padding = "6px 8px";
  overlay.style.borderRadius = "6px";
  overlay.style.background = "rgba(0, 0, 0, 0.72)";
  overlay.style.color = "#ffffff";
  overlay.style.font = "12px sans-serif";
  overlay.style.lineHeight = "1.3";

  frame.replaceChildren(createImage(imageUrl), overlay);
  container.replaceChildren(frame);
}

/**
 * @param {HTMLElement} container
 * @param {string} [message]
 * @param {"status" | "alert"} [role]
 * @returns {void}
 */
function renderPlaceholder(container, message = PLACEHOLDER_TEXT, role = "status") {
  const placeholder = document.createElement("p");
  placeholder.textContent = message;
  placeholder.role = role;
  placeholder.style.margin = "0";
  placeholder.style.padding = "16px";
  placeholder.style.color = "inherit";

  container.replaceChildren(placeholder);
}

/**
 * @param {string} imageUrl
 * @returns {HTMLImageElement}
 */
function createImage(imageUrl) {
  const image = document.createElement("img");
  image.src = imageUrl;
  image.alt = "Semantic reconstruction";
  image.style.display = "block";
  image.style.width = "100%";
  image.style.height = "100%";
  image.style.objectFit = "contain";
  return image;
}
