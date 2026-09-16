import { createFaceDetectorService } from "../../mediapipe/FaceDetectorService.js";
import { createSegmentationService } from "../../mediapipe/SegmentationService.js";
import { draw as drawFaceOverlay } from "./FaceOverlayRenderer.js";
import { draw as drawMosaic } from "./MosaicRenderer.js";
import { draw as drawSilhouette } from "./SilhouetteRenderer.js";

/**
 * @typedef {import("../../../../shared/types.js").FaceDetection} FaceDetection
 * @typedef {import("../../../../shared/types.js").FrameContext} FrameContext
 * @typedef {import("../../../../shared/types.js").Mode1DebugMetrics} Mode1DebugMetrics
 * @typedef {import("../../../../shared/types.js").Mode1FrameState} Mode1FrameState
 * @typedef {import("../../../../shared/types.js").SegmentationMask} SegmentationMask
 *
 * @typedef {object} Mode1ControllerOptions
 * @property {object} config
 * @property {HTMLCanvasElement | CanvasRenderingContext2D} silhouette
 * @property {HTMLCanvasElement | CanvasRenderingContext2D} mosaic
 * @property {HTMLCanvasElement | CanvasRenderingContext2D} faceOverlay
 */

const INITIAL_INFERENCE_TIMESTAMP_MS = Number.NEGATIVE_INFINITY;

export class Mode1Controller {
  /** @param {Mode1ControllerOptions} options */
  constructor(options) {
    if (!options?.config) {
      throw new TypeError("Mode1Controller requires app config.");
    }

    this.config = options.config;
    this.silhouetteCtx = get2dContext(options.silhouette, "silhouette");
    this.mosaicCtx = get2dContext(options.mosaic, "mosaic");
    this.faceOverlayCtx = get2dContext(options.faceOverlay, "faceOverlay");

    /** @type {FaceDetection[]} */
    this.faceDetections = [];
    /** @type {SegmentationMask | undefined} */
    this.personMask = undefined;
    /** @type {Mode1FrameState | undefined} */
    this.frameState = undefined;

    this.frameHub = null;
    this.isRunning = false;
    this.runToken = 0;
    this.faceDetectorService = null;
    this.segmentationService = null;
    this.faceDetectorReady = false;
    this.segmentationReady = false;
    this.faceInferenceBusy = false;
    this.segmentationInferenceBusy = false;
    this.lastFaceInferenceTimestampMs = INITIAL_INFERENCE_TIMESTAMP_MS;
    this.lastSegmentationInferenceTimestampMs = INITIAL_INFERENCE_TIMESTAMP_MS;
    /** @type {number | undefined} */
    this.faceInferenceMs = undefined;
    /** @type {number | undefined} */
    this.segmentationInferenceMs = undefined;
    /** @type {number | undefined} */
    this.lastFrameId = undefined;

    this.handleFrame = this.handleFrame.bind(this);
  }

  /** @param {{ subscribe(callback: (frameContext: FrameContext) => void): void, unsubscribe(callback: (frameContext: FrameContext) => void): void, videoElement?: HTMLVideoElement }} frameHub */
  start(frameHub) {
    if (!frameHub || typeof frameHub.subscribe !== "function") {
      throw new TypeError("Mode1Controller.start requires a FrameHub.");
    }

    if (this.isRunning) {
      this.stop();
    }

    this.frameHub = frameHub;
    this.isRunning = true;
    this.runToken += 1;
    const runToken = this.runToken;

    this.frameHub.subscribe(this.handleFrame);
    void this.prepareServices(runToken);
  }

  stop() {
    this.isRunning = false;
    this.runToken += 1;

    if (this.frameHub) {
      this.frameHub.unsubscribe(this.handleFrame);
    }

    this.frameHub = null;
    this.faceInferenceBusy = false;
    this.segmentationInferenceBusy = false;
  }

  /**
   * @param {FrameContext} frameContext
   * @returns {void}
   */
  handleFrame(frameContext) {
    if (!this.isRunning || !this.frameHub) {
      return;
    }

    const videoFrame = this.frameHub.videoElement;
    if (!videoFrame) {
      return;
    }

    /** @type {Mode1FrameState} */
    const frameState = {
      frameId: frameContext.frameId,
      timestampMs: frameContext.timestampMs,
      sourceFrame: videoFrame,
      faceDetections: this.faceDetections,
      personMask: this.personMask,
    };

    this.frameState = frameState;
    this.lastFrameId = frameContext.frameId;
    this.drawFrame(frameState);
    this.maybeRunSegmentation(videoFrame, frameContext.timestampMs);
    this.maybeRunFaceDetection(videoFrame, frameContext.timestampMs);
  }

  /** @returns {Mode1DebugMetrics} */
  getDebugMetrics() {
    return {
      faceInferenceMs: this.faceInferenceMs,
      segmentationInferenceMs: this.segmentationInferenceMs,
      faceConfidences: this.faceDetections.map(({ score }) => score),
      segmentationThreshold: this.config.segmentation.threshold,
      frameId: this.lastFrameId,
    };
  }

  /**
   * @param {number} runToken
   * @returns {Promise<void>}
   */
  async prepareServices(runToken) {
    if (this.segmentationService && this.faceDetectorService) {
      this.segmentationReady = true;
      this.faceDetectorReady = true;
      return;
    }

    let segmentationService;
    let faceDetectorService;

    try {
      [segmentationService, faceDetectorService] = await Promise.all([
        createSegmentationService(this.config.segmentation),
        createFaceDetectorService(this.config.faceDetector),
      ]);
    } catch {
      if (this.isCurrentRun(runToken)) {
        this.segmentationReady = false;
        this.faceDetectorReady = false;
      }

      return;
    }

    if (!this.isCurrentRun(runToken)) {
      return;
    }

    this.segmentationService = segmentationService;
    this.faceDetectorService = faceDetectorService;
    this.segmentationReady = true;
    this.faceDetectorReady = true;
  }

  /**
   * @param {Mode1FrameState} frameState
   * @returns {void}
   */
  drawFrame(frameState) {
    if (!this.isRunning) {
      return;
    }

    if (frameState.personMask) {
      drawSilhouette(this.silhouetteCtx, frameState.personMask, this.config.segmentation);
    }

    drawMosaic(
      this.mosaicCtx,
      frameState.sourceFrame,
      frameState.faceDetections,
      this.config.mosaic,
    );
    drawFaceOverlay(
      this.faceOverlayCtx,
      frameState.sourceFrame,
      frameState.faceDetections,
      this.config.faceDetector,
    );
  }

  /**
   * @param {HTMLVideoElement} videoFrame
   * @param {number} timestampMs
   * @returns {void}
   */
  maybeRunSegmentation(videoFrame, timestampMs) {
    if (
      !this.segmentationReady ||
      this.segmentationInferenceBusy ||
      !hasIntervalElapsed(
        timestampMs,
        this.lastSegmentationInferenceTimestampMs,
        this.config.segmentation.inferenceIntervalMs,
      )
    ) {
      return;
    }

    this.segmentationInferenceBusy = true;
    this.lastSegmentationInferenceTimestampMs = timestampMs;
    const runToken = this.runToken;

    Promise.resolve()
      .then(() => {
        if (!this.isCurrentRun(runToken)) {
          return this.personMask;
        }

        const inferenceStartMs = performance.now();
        try {
          return this.segmentationService.segmentForVideo(videoFrame, timestampMs);
        } finally {
          this.segmentationInferenceMs = performance.now() - inferenceStartMs;
        }
      })
      .then((personMask) => {
        if (this.isCurrentRun(runToken) && personMask) {
          this.personMask = personMask;
        }
      })
      .catch(() => {})
      .finally(() => {
        if (this.isCurrentRun(runToken)) {
          this.segmentationInferenceBusy = false;
        }
      });
  }

  /**
   * Calls FaceDetectorService once for the tick, then shares that result with
   * both face-dependent renderers on later draws.
   *
   * @param {HTMLVideoElement} videoFrame
   * @param {number} timestampMs
   * @returns {void}
   */
  maybeRunFaceDetection(videoFrame, timestampMs) {
    if (
      !this.faceDetectorReady ||
      this.faceInferenceBusy ||
      !hasIntervalElapsed(
        timestampMs,
        this.lastFaceInferenceTimestampMs,
        this.config.faceDetector.inferenceIntervalMs,
      )
    ) {
      return;
    }

    this.faceInferenceBusy = true;
    this.lastFaceInferenceTimestampMs = timestampMs;
    const runToken = this.runToken;

    Promise.resolve()
      .then(() => {
        if (!this.isCurrentRun(runToken)) {
          return this.faceDetections;
        }

        const inferenceStartMs = performance.now();
        try {
          return this.faceDetectorService.detectForVideo(videoFrame, timestampMs);
        } finally {
          this.faceInferenceMs = performance.now() - inferenceStartMs;
        }
      })
      .then((faceDetections) => {
        if (this.isCurrentRun(runToken)) {
          this.faceDetections = faceDetections;
        }
      })
      .catch(() => {})
      .finally(() => {
        if (this.isCurrentRun(runToken)) {
          this.faceInferenceBusy = false;
        }
      });
  }

  /** @param {number} runToken */
  isCurrentRun(runToken) {
    return this.isRunning && this.runToken === runToken;
  }
}

/**
 * @param {HTMLCanvasElement | CanvasRenderingContext2D | undefined} target
 * @param {string} name
 * @returns {CanvasRenderingContext2D}
 */
function get2dContext(target, name) {
  if (target && "canvas" in target) {
    return target;
  }

  const ctx = target?.getContext?.("2d");
  if (!ctx) {
    throw new TypeError(`Mode1Controller requires a 2D context for ${name}.`);
  }

  return ctx;
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

export default Mode1Controller;
