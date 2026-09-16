import { CameraInputManager } from "./camera/CameraInputManager.js";
import { FrameHub } from "./camera/FrameHub.js";
import { ModeController } from "./modes/ModeController.js";
import { Mode1Controller } from "./modes/mode1/Mode1Controller.js";
import { Mode2Controller } from "./modes/mode2/Mode2Controller.js";
import { CameraState } from "../../shared/types.js";

const CONFIG_URL = "/config/app.config.json";

const elements = {
  statusMessage: document.getElementById("statusMessage"),
  cameraSource: document.getElementById("cameraSource"),
  silhouetteCanvas: document.getElementById("silhouetteCanvas"),
  mosaicCanvas: document.getElementById("mosaicCanvas"),
  faceOverlayCanvas: document.getElementById("faceOverlayCanvas"),
  mode2LeftVideoCanvas: document.getElementById("mode2LeftVideoCanvas"),
  semanticInfoList: document.getElementById("semanticInfoList"),
  mode1Panes: document.getElementById("mode1Panes"),
  mode2Panes: document.getElementById("mode2Panes"),
  mode1Button: document.getElementById("mode1Button"),
  mode2Button: document.getElementById("mode2Button"),
};

init().catch(() => {
  showMessage("Application unavailable", "Please reload the page.");
});

async function init() {
  const config = await loadConfig();
  applyCanvasSize(config.camera);

  const cameraInputManager = new CameraInputManager();
  const cameraResult = await cameraInputManager.requestCamera(config.camera);

  if (cameraResult.state !== CameraState.ready || !cameraResult.videoElement) {
    showCameraUnavailable();
    return;
  }

  await attachCameraSource(cameraResult.videoElement);

  const frameHub = new FrameHub(elements.cameraSource);
  const mode1Controller = new Mode1Controller({
    config,
    silhouette: elements.silhouetteCanvas,
    mosaic: elements.mosaicCanvas,
    faceOverlay: elements.faceOverlayCanvas,
  });
  const mode2Controller = new Mode2Controller({
    config,
    leftVideoCanvas: elements.mode2LeftVideoCanvas,
    semanticInfoContainer: elements.semanticInfoList,
  });
  const modeController = new ModeController({
    mode1: mode1Controller,
    mode2: mode2Controller,
  });

  wireModeButtons(modeController, frameHub);
  modeController.switchTo("mode1", frameHub);
  frameHub.start();
  showMessage("Camera ready", "");
  setActiveMode("mode1");
}

async function loadConfig() {
  const response = await fetch(CONFIG_URL);
  if (!response.ok) {
    throw new Error(`Failed to load config: ${response.status}`);
  }

  return response.json();
}

/**
 * @param {{ width: number, height: number }} cameraConfig
 */
function applyCanvasSize(cameraConfig) {
  for (const canvas of [
    elements.silhouetteCanvas,
    elements.mosaicCanvas,
    elements.faceOverlayCanvas,
    elements.mode2LeftVideoCanvas,
  ]) {
    canvas.width = cameraConfig.width;
    canvas.height = cameraConfig.height;
  }
}

/**
 * @param {HTMLVideoElement} cameraVideo
 */
async function attachCameraSource(cameraVideo) {
  elements.cameraSource.srcObject = cameraVideo.srcObject;
  await elements.cameraSource.play();
}

/**
 * @param {ModeController} modeController
 * @param {FrameHub} frameHub
 */
function wireModeButtons(modeController, frameHub) {
  elements.mode1Button.addEventListener("click", () => {
    modeController.switchTo("mode1", frameHub);
    setActiveMode("mode1");
  });

  elements.mode2Button.addEventListener("click", () => {
    modeController.switchTo("mode2", frameHub);
    setActiveMode("mode2");
  });
}

/** @param {"mode1" | "mode2"} mode */
function setActiveMode(mode) {
  elements.mode1Button.classList.toggle("is-active", mode === "mode1");
  elements.mode2Button.classList.toggle("is-active", mode === "mode2");
  elements.mode1Button.setAttribute("aria-pressed", String(mode === "mode1"));
  elements.mode2Button.setAttribute("aria-pressed", String(mode === "mode2"));
  elements.mode1Panes.classList.toggle("is-hidden", mode !== "mode1");
  elements.mode2Panes.classList.toggle("is-hidden", mode !== "mode2");
  elements.mode1Panes.setAttribute("aria-hidden", String(mode !== "mode1"));
  elements.mode2Panes.setAttribute("aria-hidden", String(mode !== "mode2"));
}

function showCameraUnavailable() {
  showMessage("Camera unavailable", "Please allow camera access.");
}

function showMessage(title, detail) {
  elements.statusMessage.textContent = detail ? `${title} / ${detail}` : title;
}
