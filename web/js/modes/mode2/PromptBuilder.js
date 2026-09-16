/**
 * @typedef {import("../../../../shared/types.js").SemanticPacket} SemanticPacket
 * @typedef {import("../../../../shared/types.js").SemanticObject} SemanticObject
 * @typedef {import("../../../../shared/types.js").ImageGenerationConfig} ImageGenerationConfig
 */

const COUNT_WORDS = new Map([
  [1, "one"],
  [2, "two"],
  [3, "three"],
  [4, "four"],
  [5, "five"],
]);

/**
 * Builds a deterministic text-to-image prompt from semantic state.
 *
 * @param {SemanticPacket} semanticPacket
 * @param {ImageGenerationConfig} imageGenerationConfig
 * @returns {string}
 */
export function buildPrompt(semanticPacket, imageGenerationConfig) {
  const objectPrompts = semanticPacket.objects.map(formatObjectPrompt);
  const scenePrompt = formatScenePrompt(semanticPacket);
  const stylePrompt = formatStylePrompt(imageGenerationConfig);

  const subjectPrompt =
    objectPrompts.length > 0
      ? `A semantic reconstruction featuring ${joinClauses(objectPrompts)}`
      : "A semantic reconstruction of the detected scene";

  return [subjectPrompt, scenePrompt, stylePrompt].filter(Boolean).join(". ") + ".";
}

/**
 * @param {SemanticObject} object
 * @returns {string}
 */
function formatObjectPrompt(object) {
  const count = object.count ?? 1;
  const parts = [formatCount(count), object.size, pluralizeLabel(object.label, count)]
    .filter(Boolean)
    .join(" ");
  const location = object.position ? ` in the ${object.position}` : "";
  const attributes =
    object.attributes && object.attributes.length > 0
      ? ` with ${joinClauses(object.attributes)}`
      : "";

  return `${parts}${location}${attributes}`;
}

/**
 * @param {SemanticPacket} semanticPacket
 * @returns {string}
 */
function formatScenePrompt(semanticPacket) {
  const sceneParts = [
    semanticPacket.scene?.environment ? `environment: ${semanticPacket.scene.environment}` : "",
    semanticPacket.scene?.layout ? `layout: ${semanticPacket.scene.layout}` : "",
  ].filter(Boolean);

  return sceneParts.length > 0 ? `Scene context includes ${joinClauses(sceneParts)}` : "";
}

/**
 * @param {ImageGenerationConfig} imageGenerationConfig
 * @returns {string}
 */
function formatStylePrompt(imageGenerationConfig) {
  return imageGenerationConfig.stylePreset ? `Style: ${imageGenerationConfig.stylePreset}` : "";
}

/**
 * @param {number} count
 * @returns {string}
 */
function formatCount(count) {
  return COUNT_WORDS.get(count) ?? String(count);
}

/**
 * @param {string} label
 * @param {number} count
 * @returns {string}
 */
function pluralizeLabel(label, count) {
  if (count === 1 || label.endsWith("s")) {
    return label;
  }

  return `${label}s`;
}

/**
 * @param {string[]} clauses
 * @returns {string}
 */
function joinClauses(clauses) {
  if (clauses.length <= 1) {
    return clauses[0] ?? "";
  }

  if (clauses.length === 2) {
    return `${clauses[0]} and ${clauses[1]}`;
  }

  return `${clauses.slice(0, -1).join(", ")}, and ${clauses.at(-1)}`;
}
