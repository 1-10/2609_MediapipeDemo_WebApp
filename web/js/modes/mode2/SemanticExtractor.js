import { buildPacket } from "./SemanticPacketBuilder.js";

/**
 * @typedef {import("../../../../shared/types.js").ObjectDetection} ObjectDetection
 * @typedef {import("../../../../shared/types.js").SemanticPacket} SemanticPacket
 *
 * @typedef {object} ObjectDetectorService
 * @property {(videoEl: HTMLVideoElement, timestampMs: number) => ObjectDetection[] | Promise<ObjectDetection[]>} detectForVideo
 *
 * @typedef {object} SemanticExtractorOptions
 * @property {ObjectDetectorService} objectDetectorService
 * @property {object} config
 *
 * @typedef {object} SemanticExtractor
 * @property {(videoEl: HTMLVideoElement, timestampMs: number) => void} tick
 * @property {() => SemanticPacket | null} getLatestPacket
 */

const INITIAL_UPDATE_TIMESTAMP_MS = Number.NEGATIVE_INFINITY;

/**
 * @param {SemanticExtractorOptions} options
 * @returns {SemanticExtractor}
 */
export function createSemanticExtractor(options) {
  const objectDetectorService = options?.objectDetectorService;
  const config = options?.config;

  if (!objectDetectorService || typeof objectDetectorService.detectForVideo !== "function") {
    throw new TypeError("createSemanticExtractor requires an ObjectDetectorService.");
  }

  if (
    !config?.semantic ||
    !Number.isFinite(config.semantic.updateIntervalMs) ||
    !config.objectDetector
  ) {
    throw new TypeError("createSemanticExtractor requires app config.");
  }

  const updateIntervalMs = config.semantic.updateIntervalMs;
  /** @type {SemanticPacket | null} */
  let latestPacket = null;
  let isBusy = false;
  let lastUpdateTimestampMs = INITIAL_UPDATE_TIMESTAMP_MS;

  return {
    tick(videoEl, timestampMs) {
      if (
        isBusy ||
        !hasIntervalElapsed(timestampMs, lastUpdateTimestampMs, updateIntervalMs)
      ) {
        return;
      }

      isBusy = true;
      lastUpdateTimestampMs = timestampMs;

      Promise.resolve()
        .then(() => objectDetectorService.detectForVideo(videoEl, timestampMs))
        .then((detections) => {
          latestPacket = buildPacket(
            detections,
            videoEl.videoWidth,
            videoEl.videoHeight,
            timestampMs,
          );
        })
        .catch(() => {})
        .finally(() => {
          isBusy = false;
        });
    },

    getLatestPacket() {
      return latestPacket;
    },
  };
}

/**
 * @param {number} timestampMs
 * @param {number} lastTimestampMs
 * @param {number} intervalMs
 * @returns {boolean}
 */
function hasIntervalElapsed(timestampMs, lastTimestampMs, intervalMs) {
  return timestampMs - lastTimestampMs >= intervalMs;
}
