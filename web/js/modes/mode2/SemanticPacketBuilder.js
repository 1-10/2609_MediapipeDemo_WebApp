/**
 * @typedef {import("../../../../shared/types.js").ObjectDetection} ObjectDetection
 * @typedef {import("../../../../shared/types.js").SemanticObject} SemanticObject
 * @typedef {import("../../../../shared/types.js").SemanticPacket} SemanticPacket
 */

const SMALL_AREA_RATIO_MAX = 0.05;
const MEDIUM_AREA_RATIO_MAX = 0.2;

/**
 * Builds a semantic packet from object detections.
 *
 * @param {ObjectDetection[]} detections
 * @param {number} frameWidth
 * @param {number} frameHeight
 * @param {number} timestampMs
 * @returns {SemanticPacket}
 */
export function buildPacket(detections, frameWidth, frameHeight, timestampMs) {
  /** @type {Map<string, SemanticObject>} */
  const groupedObjects = new Map();

  for (const detection of detections) {
    const existingObject = groupedObjects.get(detection.label);

    if (existingObject) {
      existingObject.count = (existingObject.count ?? 1) + 1;
      continue;
    }

    groupedObjects.set(detection.label, {
      label: detection.label,
      count: 1,
      position: getPosition(detection.boundingBox, frameWidth),
      size: getSize(detection.boundingBox, frameWidth, frameHeight),
    });
  }

  return {
    timestampMs,
    objects: Array.from(groupedObjects.values()),
  };
}

/**
 * @param {import("../../../../shared/types.js").BoundingBox} boundingBox
 * @param {number} frameWidth
 * @returns {"left" | "center" | "right"}
 */
function getPosition(boundingBox, frameWidth) {
  const centerXRatio = (boundingBox.originX + boundingBox.width / 2) / frameWidth;

  if (centerXRatio < 1 / 3) {
    return "left";
  }

  if (centerXRatio < 2 / 3) {
    return "center";
  }

  return "right";
}

/**
 * @param {import("../../../../shared/types.js").BoundingBox} boundingBox
 * @param {number} frameWidth
 * @param {number} frameHeight
 * @returns {"small" | "medium" | "large"}
 */
function getSize(boundingBox, frameWidth, frameHeight) {
  const areaRatio = (boundingBox.width * boundingBox.height) / (frameWidth * frameHeight);

  if (areaRatio < SMALL_AREA_RATIO_MAX) {
    return "small";
  }

  if (areaRatio < MEDIUM_AREA_RATIO_MAX) {
    return "medium";
  }

  return "large";
}
