/**
 * @import { FrameContext } from "../../../shared/types.js"
 */

const MIN_TIMESTAMP_STEP_MS = 0.001;
const FPS_WINDOW_MS = 1_000;

export class FrameHub {
  /**
   * @param {HTMLVideoElement} videoElement
   */
  constructor(videoElement) {
    this.videoElement = videoElement;
    /** @type {Set<(frameContext: FrameContext) => void>} */
    this.subscribers = new Set();
    this.frameId = 0;
    this.animationFrameId = null;
    this.lastTimestampMs = 0;
    this.isRunning = false;
    /** @type {number[]} */
    this.fpsTickTimestampsMs = [];

    this.tick = this.tick.bind(this);
  }

  /**
   * @param {(frameContext: FrameContext) => void} callback
   */
  subscribe(callback) {
    this.subscribers.add(callback);
  }

  /**
   * @param {(frameContext: FrameContext) => void} callback
   */
  unsubscribe(callback) {
    this.subscribers.delete(callback);
  }

  start() {
    if (this.isRunning) {
      return;
    }

    this.isRunning = true;
    this.animationFrameId = requestAnimationFrame(this.tick);
  }

  stop() {
    if (this.animationFrameId !== null) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }

    this.isRunning = false;
  }

  /**
   * @returns {number}
   */
  getFramesPerSecond() {
    if (this.fpsTickTimestampsMs.length < 2) {
      return 0;
    }

    const firstTimestampMs = this.fpsTickTimestampsMs[0];
    const lastTimestampMs = this.fpsTickTimestampsMs.at(-1);
    const elapsedMs = lastTimestampMs - firstTimestampMs;

    return ((this.fpsTickTimestampsMs.length - 1) * 1_000) / elapsedMs;
  }

  /**
   * @param {DOMHighResTimeStamp} timestampMs
   */
  tick(timestampMs) {
    if (!this.isRunning) {
      return;
    }

    const nextTimestampMs =
      timestampMs > this.lastTimestampMs
        ? timestampMs
        : this.lastTimestampMs + MIN_TIMESTAMP_STEP_MS;

    this.lastTimestampMs = nextTimestampMs;

    /** @type {FrameContext} */
    const frameContext = {
      frameId: this.frameId,
      timestampMs: nextTimestampMs,
    };

    this.frameId += 1;

    this.fpsTickTimestampsMs.push(nextTimestampMs);
    const windowStartTimestampMs = nextTimestampMs - FPS_WINDOW_MS;
    while (this.fpsTickTimestampsMs[0] < windowStartTimestampMs) {
      this.fpsTickTimestampsMs.shift();
    }

    for (const subscriber of this.subscribers) {
      subscriber(frameContext);
    }

    this.animationFrameId = requestAnimationFrame(this.tick);
  }
}

export default FrameHub;
