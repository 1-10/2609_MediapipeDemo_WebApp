import { createObjectDetectorService } from "../../mediapipe/ObjectDetectorService.js";
import { generateImage } from "../../generation/GenerationClient.js";
import { GenerationStatus } from "../../../../shared/types.js";
import { buildPrompt } from "./PromptBuilder.js";
import { render as renderReconstruction } from "./ReconstructionRenderer.js";
import { createSemanticExtractor } from "./SemanticExtractor.js";
import { formatSemanticLines } from "./SemanticInfoFormatter.js";

/**
 * @typedef {import("../../../../shared/types.js").FrameContext} FrameContext
 * @typedef {import("../../../../shared/types.js").Mode2DebugMetrics} Mode2DebugMetrics
 * @typedef {import("../../../../shared/types.js").SemanticPacket} SemanticPacket
 *
 * @typedef {object} Mode2ControllerOptions
 * @property {object} config
 * @property {HTMLCanvasElement | CanvasRenderingContext2D} leftVideoCanvas
 * @property {Element} semanticInfoContainer
 * @property {HTMLElement} reconstructionContainer
 */

export class Mode2Controller {
  /** @param {Mode2ControllerOptions} options */
  constructor(options) {
    if (!options?.config) {
      throw new TypeError("Mode2Controller requires app config.");
    }

    if (!options?.semanticInfoContainer) {
      throw new TypeError("Mode2Controller requires a semantic info container.");
    }

    if (!options?.reconstructionContainer) {
      throw new TypeError("Mode2Controller requires a reconstruction container.");
    }

    this.config = options.config;
    this.leftVideoCtx = get2dContext(options.leftVideoCanvas, "leftVideoCanvas");
    this.semanticInfoContainer = options.semanticInfoContainer;
    this.reconstructionContainer = options.reconstructionContainer;

    this.frameHub = null;
    this.isRunning = false;
    this.runToken = 0;
    this.objectDetectorService = null;
    this.semanticExtractor = null;
    this.servicesReady = false;
    this.lastRenderedPacketKey = "";
    this.lastGeneratedPacketKey = "";
    this.generationStatus = GenerationStatus.idle;
    /** @type {Mode2DebugMetrics} */
    this.debugMetrics = {
      generatorErrorCount: 0,
      generatedImageCount: 0,
    };

    this.handleFrame = this.handleFrame.bind(this);
  }

  /** @param {{ subscribe(callback: (frameContext: FrameContext) => void): void, unsubscribe(callback: (frameContext: FrameContext) => void): void, videoElement?: HTMLVideoElement }} frameHub */
  start(frameHub) {
    if (!frameHub || typeof frameHub.subscribe !== "function") {
      throw new TypeError("Mode2Controller.start requires a FrameHub.");
    }

    if (this.isRunning) {
      this.stop();
    }

    this.frameHub = frameHub;
    this.isRunning = true;
    this.runToken += 1;
    const runToken = this.runToken;
    this.lastGeneratedPacketKey = "";
    this.generationStatus = GenerationStatus.idle;
    renderReconstruction(this.reconstructionContainer, { status: GenerationStatus.idle });

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

    this.drawLiveVideo(videoFrame);

    if (this.servicesReady && this.semanticExtractor) {
      const detectionStartedAt = performance.now();
      this.semanticExtractor.tick(videoFrame, frameContext.timestampMs);
      this.debugMetrics.objectDetectionMs = performance.now() - detectionStartedAt;
      const packet = this.semanticExtractor.getLatestPacket();
      if (packet) {
        this.debugMetrics.semanticPacketBytes = new TextEncoder().encode(
          JSON.stringify(packet),
        ).length;
      }
      this.renderLatestPacket(packet);
      this.generateLatestPacket(packet);
    }
  }

  /**
   * @param {SemanticPacket | null} packet
   * @returns {void}
   */
  generateLatestPacket(packet) {
    if (!this.isRunning || !packet || this.generationStatus === GenerationStatus.generating) {
      return;
    }

    const packetKey = JSON.stringify(packet);
    if (packetKey === this.lastGeneratedPacketKey) {
      return;
    }

    const prompt = buildPrompt(packet, this.config.imageGeneration);
    this.debugMetrics.promptLength = prompt.length;
    this.lastGeneratedPacketKey = packetKey;
    this.generationStatus = GenerationStatus.generating;
    renderReconstruction(this.reconstructionContainer, {
      status: GenerationStatus.generating,
    });

    const runToken = this.runToken;
    void this.requestGeneration(prompt, runToken);
  }

  /**
   * @param {string} prompt
   * @param {number} runToken
   * @returns {Promise<void>}
   */
  async requestGeneration(prompt, runToken) {
    const generationStartedAt = performance.now();

    try {
      const result = await generateImage(prompt);
      this.debugMetrics.imageGenerationLatencyMs = performance.now() - generationStartedAt;
      this.debugMetrics.generatedImageCount += 1;
      if (!this.isCurrentRun(runToken)) {
        return;
      }

      this.generationStatus = GenerationStatus.success;
      renderReconstruction(this.reconstructionContainer, {
        status: GenerationStatus.success,
        imageUrl: result.imageUrl,
      });
    } catch (error) {
      this.debugMetrics.imageGenerationLatencyMs = performance.now() - generationStartedAt;
      this.debugMetrics.generatorErrorCount += 1;
      if (!this.isCurrentRun(runToken)) {
        return;
      }

      this.generationStatus = GenerationStatus.error;
      renderReconstruction(this.reconstructionContainer, {
        status: GenerationStatus.error,
        errorMessage: error instanceof Error ? error.message : String(error),
      });
    }
  }

  /**
   * @param {number} runToken
   * @returns {Promise<void>}
   */
  async prepareServices(runToken) {
    if (this.semanticExtractor) {
      this.servicesReady = true;
      return;
    }

    let objectDetectorService;

    try {
      objectDetectorService = await createObjectDetectorService(this.config.objectDetector);
    } catch {
      if (this.isCurrentRun(runToken)) {
        this.servicesReady = false;
      }

      return;
    }

    if (!this.isCurrentRun(runToken)) {
      return;
    }

    this.objectDetectorService = objectDetectorService;
    this.semanticExtractor = createSemanticExtractor({
      objectDetectorService,
      config: this.config,
    });
    this.servicesReady = true;
  }

  /**
   * @param {HTMLVideoElement} videoFrame
   * @returns {void}
   */
  drawLiveVideo(videoFrame) {
    if (!this.isRunning) {
      return;
    }

    this.leftVideoCtx.drawImage(
      videoFrame,
      0,
      0,
      this.leftVideoCtx.canvas.width,
      this.leftVideoCtx.canvas.height,
    );
  }

  /**
   * @param {SemanticPacket | null} packet
   * @returns {void}
   */
  renderLatestPacket(packet) {
    const packetKey = packet ? JSON.stringify(packet) : "";
    if (packetKey === this.lastRenderedPacketKey) {
      return;
    }

    this.lastRenderedPacketKey = packetKey;
    const lines = packet ? formatSemanticLines(packet) : [];
    this.semanticInfoContainer.replaceChildren(
      ...lines.map((line) => {
        const item = document.createElement("li");
        item.textContent = line;
        return item;
      }),
    );
  }

  /** @param {number} runToken */
  isCurrentRun(runToken) {
    return this.isRunning && this.runToken === runToken;
  }

  /** @returns {Mode2DebugMetrics} */
  getDebugMetrics() {
    return { ...this.debugMetrics };
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
    throw new TypeError(`Mode2Controller requires a 2D context for ${name}.`);
  }

  return ctx;
}

export default Mode2Controller;
