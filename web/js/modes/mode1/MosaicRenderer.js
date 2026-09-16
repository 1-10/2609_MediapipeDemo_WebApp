/**
 * @typedef {import("../../../../shared/types.js").FaceDetection} FaceDetection
 * @typedef {{ blockSize: number, bboxExpansionHorizontal: number, bboxExpansionVertical: number }} MosaicConfig
 */

let pixelationCanvas;
let pixelationCtx;

/**
 * Draws a live video frame and pixelates detected face regions.
 *
 * @param {CanvasRenderingContext2D} ctx
 * @param {HTMLVideoElement} videoFrame
 * @param {FaceDetection[]} faceDetections
 * @param {MosaicConfig} config
 * @returns {void}
 */
export function draw(ctx, videoFrame, faceDetections, config) {
  const canvas = ctx.canvas;
  const canvasWidth = canvas.width;
  const canvasHeight = canvas.height;

  if (canvasWidth <= 0 || canvasHeight <= 0) {
    return;
  }

  ctx.drawImage(videoFrame, 0, 0, canvasWidth, canvasHeight);

  if (!Array.isArray(faceDetections) || faceDetections.length === 0) {
    return;
  }

  const sourceWidth = getPositiveNumber(videoFrame.videoWidth, canvasWidth);
  const sourceHeight = getPositiveNumber(videoFrame.videoHeight, canvasHeight);
  const scaleX = canvasWidth / sourceWidth;
  const scaleY = canvasHeight / sourceHeight;
  const blockSize = Math.max(1, Math.floor(getPositiveNumber(config?.blockSize, 1)));
  const expansionHorizontal = Math.max(0, getPositiveNumber(config?.bboxExpansionHorizontal, 0));
  const expansionVertical = Math.max(0, getPositiveNumber(config?.bboxExpansionVertical, 0));
  const previousSmoothing = ctx.imageSmoothingEnabled;

  ctx.imageSmoothingEnabled = false;

  for (const detection of faceDetections) {
    const region = getExpandedRegion(
      detection?.boundingBox,
      expansionHorizontal,
      expansionVertical,
      scaleX,
      scaleY,
      canvasWidth,
      canvasHeight,
    );

    if (!region) {
      continue;
    }

    drawPixelatedRegion(ctx, region, blockSize);
  }

  ctx.imageSmoothingEnabled = previousSmoothing;
}

/**
 * @param {import("../../../../shared/types.js").BoundingBox | undefined} boundingBox
 * @param {number} expansionHorizontal
 * @param {number} expansionVertical
 * @param {number} scaleX
 * @param {number} scaleY
 * @param {number} canvasWidth
 * @param {number} canvasHeight
 * @returns {{ x: number, y: number, width: number, height: number } | null}
 */
function getExpandedRegion(
  boundingBox,
  expansionHorizontal,
  expansionVertical,
  scaleX,
  scaleY,
  canvasWidth,
  canvasHeight,
) {
  if (!boundingBox) {
    return null;
  }

  const width = getPositiveNumber(boundingBox.width, 0) * scaleX;
  const height = getPositiveNumber(boundingBox.height, 0) * scaleY;

  if (width <= 0 || height <= 0) {
    return null;
  }

  const originX = getFiniteNumber(boundingBox.originX, 0) * scaleX;
  const originY = getFiniteNumber(boundingBox.originY, 0) * scaleY;
  const expansionX = width * expansionHorizontal;
  const expansionY = height * expansionVertical;
  const x1 = clamp(originX - expansionX, 0, canvasWidth);
  const y1 = clamp(originY - expansionY, 0, canvasHeight);
  const x2 = clamp(originX + width + expansionX, 0, canvasWidth);
  const y2 = clamp(originY + height + expansionY, 0, canvasHeight);
  const expandedWidth = Math.round(x2 - x1);
  const expandedHeight = Math.round(y2 - y1);

  if (expandedWidth <= 0 || expandedHeight <= 0) {
    return null;
  }

  return {
    x: Math.round(x1),
    y: Math.round(y1),
    width: expandedWidth,
    height: expandedHeight,
  };
}

/**
 * @param {CanvasRenderingContext2D} ctx
 * @param {{ x: number, y: number, width: number, height: number }} region
 * @param {number} blockSize
 * @returns {void}
 */
function drawPixelatedRegion(ctx, region, blockSize) {
  const mosaicWidth = Math.max(1, Math.ceil(region.width / blockSize));
  const mosaicHeight = Math.max(1, Math.ceil(region.height / blockSize));
  const offscreen = getPixelationContext(mosaicWidth, mosaicHeight);

  offscreen.ctx.imageSmoothingEnabled = true;
  offscreen.ctx.clearRect(0, 0, mosaicWidth, mosaicHeight);
  offscreen.ctx.drawImage(
    ctx.canvas,
    region.x,
    region.y,
    region.width,
    region.height,
    0,
    0,
    mosaicWidth,
    mosaicHeight,
  );

  ctx.drawImage(
    offscreen.canvas,
    0,
    0,
    mosaicWidth,
    mosaicHeight,
    region.x,
    region.y,
    region.width,
    region.height,
  );
}

/**
 * @param {number} width
 * @param {number} height
 * @returns {{ canvas: HTMLCanvasElement | OffscreenCanvas, ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D }}
 */
function getPixelationContext(width, height) {
  if (!pixelationCanvas) {
    pixelationCanvas = createCanvas(width, height);
    pixelationCtx = pixelationCanvas.getContext("2d");
  }

  pixelationCanvas.width = width;
  pixelationCanvas.height = height;

  return {
    canvas: pixelationCanvas,
    ctx: pixelationCtx,
  };
}

/**
 * @param {number} width
 * @param {number} height
 * @returns {HTMLCanvasElement | OffscreenCanvas}
 */
function createCanvas(width, height) {
  if (typeof OffscreenCanvas === "function") {
    return new OffscreenCanvas(width, height);
  }

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  return canvas;
}

/**
 * @param {number} value
 * @param {number} fallback
 * @returns {number}
 */
function getPositiveNumber(value, fallback) {
  return Number.isFinite(value) && value > 0 ? value : fallback;
}

/**
 * @param {number} value
 * @param {number} fallback
 * @returns {number}
 */
function getFiniteNumber(value, fallback) {
  return Number.isFinite(value) ? value : fallback;
}

/**
 * @param {number} value
 * @param {number} min
 * @param {number} max
 * @returns {number}
 */
function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}
