/**
 * Coordinates switching between mode controllers that implement:
 * { start(frameHub), stop() }
 */
export class ModeController {
  /**
   * @param {{ mode1: { start(frameHub: unknown): unknown, stop(): unknown }, mode2: { start(frameHub: unknown): unknown, stop(): unknown } }} controllers
   * @param {"mode1" | "mode2"} [initialMode]
   */
  constructor(controllers, initialMode = "mode1") {
    if (!controllers?.mode1 || !controllers?.mode2) {
      throw new TypeError("ModeController requires mode1 and mode2 controllers");
    }

    this.controllers = controllers;
    this.activeMode = initialMode;
    this.#assertMode(initialMode);
  }

  /**
   * @param {"mode1" | "mode2"} mode
   * @param {unknown} frameHub
   */
  switchTo(mode, frameHub) {
    this.#assertMode(mode);

    this.controllers[this.activeMode].stop();
    this.activeMode = mode;
    this.controllers[this.activeMode].start(frameHub);
  }

  /** @param {string} mode */
  #assertMode(mode) {
    if (mode !== "mode1" && mode !== "mode2") {
      throw new TypeError(`Unsupported mode: ${mode}`);
    }
  }
}
