import { FilesetResolver } from "/vendor/tasks-vision/vision_bundle.mjs";

const VISION_WASM_BASE_PATH = "/vendor/tasks-vision/wasm";

let visionFilesetPromise = null;

export function getVisionFileset() {
  visionFilesetPromise ??= FilesetResolver.forVisionTasks(VISION_WASM_BASE_PATH);
  return visionFilesetPromise;
}
