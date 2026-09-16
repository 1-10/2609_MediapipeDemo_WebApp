import { CameraState } from "../../../shared/types.js";

const DENIED_ERROR_NAMES = new Set([
  "NotAllowedError",
  "PermissionDeniedError",
  "SecurityError",
]);

/**
 * Owns the single webcam stream used by the application.
 */
export class CameraInputManager {
  constructor({ mediaDevices = globalThis.navigator?.mediaDevices } = {}) {
    this.mediaDevices = mediaDevices;
    this.state = CameraState.idle;
    this.videoElement = null;
    this.cameraRequestPromise = null;
    this.cameraResult = null;
  }

  /**
   * @returns {import("../../../shared/types.js").CameraStateValue}
   */
  getState() {
    return this.state;
  }

  /**
   * @param {{ width: number, height: number }} options
   * @returns {Promise<{ videoElement: HTMLVideoElement | null, state: import("../../../shared/types.js").CameraStateValue }>}
   */
  requestCamera({ width, height }) {
    if (this.cameraResult) {
      return Promise.resolve(this.cameraResult);
    }

    if (this.cameraRequestPromise) {
      return this.cameraRequestPromise;
    }

    this.state = CameraState.requesting;
    this.cameraRequestPromise = this.#requestCameraStream({ width, height });

    return this.cameraRequestPromise;
  }

  async #requestCameraStream({ width, height }) {
    if (!this.mediaDevices?.getUserMedia) {
      return this.#storeResult(null, CameraState.error);
    }

    try {
      const stream = await this.mediaDevices.getUserMedia({
        video: {
          width: { ideal: width },
          height: { ideal: height },
        },
        audio: false,
      });

      const videoElement = this.#createVideoElement(stream);

      return this.#storeResult(videoElement, CameraState.ready);
    } catch (error) {
      const state = DENIED_ERROR_NAMES.has(error?.name)
        ? CameraState.denied
        : CameraState.error;

      return this.#storeResult(null, state);
    } finally {
      this.cameraRequestPromise = null;
    }
  }

  #createVideoElement(stream) {
    const videoElement = document.createElement("video");
    videoElement.autoplay = true;
    videoElement.muted = true;
    videoElement.playsInline = true;
    videoElement.srcObject = stream;

    this.videoElement = videoElement;

    return videoElement;
  }

  #storeResult(videoElement, state) {
    this.state = state;
    this.cameraResult = { videoElement, state };

    return this.cameraResult;
  }
}

export default CameraInputManager;
