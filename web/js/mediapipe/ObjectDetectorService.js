import { ObjectDetector } from "/vendor/tasks-vision/vision_bundle.mjs";
import { getVisionFileset } from "./visionRuntime.js";

/**
 * @typedef {import("../../../shared/types.js").ObjectDetection} ObjectDetection
 */

/**
 * @typedef {object} ObjectDetectorConfig
 * @property {string} modelUrl
 * @property {number} scoreThreshold
 * @property {number} maxResults
 */

/**
 * @typedef {object} ObjectDetectorService
 * @property {(videoEl: HTMLVideoElement, timestampMs: number) => ObjectDetection[]} detectForVideo
 */

/**
 * @param {ObjectDetectorConfig} config
 * @returns {Promise<ObjectDetectorService>}
 */
export async function createObjectDetectorService(config) {
  const vision = await getVisionFileset();
  const detector = await ObjectDetector.createFromOptions(vision, {
    baseOptions: {
      modelAssetPath: config.modelUrl,
    },
    runningMode: "VIDEO",
    scoreThreshold: config.scoreThreshold,
    maxResults: config.maxResults,
  });

  return {
    detectForVideo(videoEl, timestampMs) {
      const result = detector.detectForVideo(videoEl, timestampMs);
      return result.detections.flatMap(toObjectDetection);
    },
  };
}

/**
 * @param {import("/vendor/tasks-vision/vision_bundle.mjs").Detection} detection
 * @returns {ObjectDetection[]}
 */
function toObjectDetection(detection) {
  if (!detection.boundingBox) {
    return [];
  }

  const category = detection.categories.reduce(
    (bestCategory, currentCategory) =>
      currentCategory.score > bestCategory.score ? currentCategory : bestCategory,
    detection.categories[0],
  );

  if (!category) {
    return [];
  }

  const { originX, originY, width, height } = detection.boundingBox;

  return [
    {
      boundingBox: { originX, originY, width, height },
      label: category.categoryName,
      score: category.score,
    },
  ];
}
