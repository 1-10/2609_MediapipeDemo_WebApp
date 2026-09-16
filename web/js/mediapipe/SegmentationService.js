import { ImageSegmenter } from "/vendor/tasks-vision/vision_bundle.mjs";
import { getVisionFileset } from "./visionRuntime.js";

/**
 * @typedef {import("../../../shared/types.js").SegmentationMask} SegmentationMask
 *
 * @typedef {object} SegmentationConfig
 * @property {string} modelUrl
 */

const PERSON_MASK_INDEX = 0;

/**
 * @param {SegmentationConfig} config
 * @returns {Promise<{ segmentForVideo: (videoEl: HTMLVideoElement, timestampMs: number) => SegmentationMask }>}
 */
export async function createSegmentationService(config) {
  const vision = await getVisionFileset();
  const segmenter = await ImageSegmenter.createFromOptions(vision, {
    baseOptions: {
      modelAssetPath: config.modelUrl,
    },
    runningMode: "VIDEO",
    outputConfidenceMasks: true,
  });

  return {
    segmentForVideo(videoEl, timestampMs) {
      const result = segmenter.segmentForVideo(videoEl, timestampMs);
      const confidenceMask = result.confidenceMasks?.[PERSON_MASK_INDEX];

      if (!confidenceMask) {
        throw new Error("ImageSegmenter did not return a person confidence mask.");
      }

      return createSegmentationMask(confidenceMask);
    },
  };
}

/**
 * @param {import("/vendor/tasks-vision/vision_bundle.mjs").MPMask} confidenceMask
 * @returns {SegmentationMask}
 */
function createSegmentationMask(confidenceMask) {
  const { width, height } = confidenceMask;
  const probabilities = confidenceMask.getAsFloat32Array().slice();

  return {
    width,
    height,
    getPersonProbability(x, y) {
      const pixelX = Math.trunc(x);
      const pixelY = Math.trunc(y);

      if (pixelX < 0 || pixelX >= width || pixelY < 0 || pixelY >= height) {
        return 0;
      }

      return probabilities[pixelY * width + pixelX] ?? 0;
    },
  };
}
