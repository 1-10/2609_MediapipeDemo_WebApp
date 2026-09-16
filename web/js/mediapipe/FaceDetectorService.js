import { FaceDetector } from "/vendor/tasks-vision/vision_bundle.mjs";
import { getVisionFileset } from "./visionRuntime.js";

/**
 * @typedef {import("../../../shared/types.js").FaceDetection} FaceDetection
 */

/**
 * @typedef {object} FaceDetectorConfig
 * @property {string} modelUrl
 * @property {number} minDetectionConfidence
 */

/**
 * @typedef {object} FaceDetectorService
 * @property {(videoEl: HTMLVideoElement, timestampMs: number) => FaceDetection[]} detectForVideo
 */

/**
 * @param {FaceDetectorConfig} config
 * @returns {Promise<FaceDetectorService>}
 */
export async function createFaceDetectorService(config) {
  const vision = await getVisionFileset();
  const detector = await FaceDetector.createFromOptions(vision, {
    baseOptions: {
      modelAssetPath: config.modelUrl,
    },
    runningMode: "VIDEO",
    minDetectionConfidence: config.minDetectionConfidence,
  });

  return {
    detectForVideo(videoEl, timestampMs) {
      const result = detector.detectForVideo(videoEl, timestampMs);
      return result.detections.flatMap(toFaceDetection);
    },
  };
}

/**
 * @param {import("/vendor/tasks-vision/vision_bundle.mjs").Detection} detection
 * @returns {FaceDetection[]}
 */
function toFaceDetection(detection) {
  if (!detection.boundingBox) {
    return [];
  }

  const { originX, originY, width, height } = detection.boundingBox;

  return [
    {
      boundingBox: { originX, originY, width, height },
      score: detection.categories[0]?.score ?? 0,
    },
  ];
}
