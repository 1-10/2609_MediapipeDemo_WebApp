/**
 * @typedef {import("../../../../shared/types.js").FaceDetection} FaceDetection
 */

const BOX_COLOR = "#22d3ee";
const LABEL_BACKGROUND = "rgba(0, 0, 0, 0.72)";
const LABEL_COLOR = "#ffffff";
const LABEL_FONT = "14px sans-serif";
const LINE_WIDTH = 3;
const LABEL_PADDING_X = 6;
const LABEL_PADDING_Y = 4;

/**
 * Draws the source frame with face detection boxes and confidence labels.
 *
 * @param {CanvasRenderingContext2D} ctx
 * @param {CanvasImageSource} videoFrame
 * @param {FaceDetection[]} faceDetections
 * @param {object} config
 * @returns {void}
 */
export function draw(ctx, videoFrame, faceDetections, config) {
  void config;

  const { width, height } = ctx.canvas;
  ctx.drawImage(videoFrame, 0, 0, width, height);

  ctx.save();
  ctx.lineWidth = LINE_WIDTH;
  ctx.strokeStyle = BOX_COLOR;
  ctx.fillStyle = LABEL_COLOR;
  ctx.font = LABEL_FONT;
  ctx.textBaseline = "top";

  for (const detection of faceDetections) {
    drawDetection(ctx, detection);
  }

  ctx.restore();
}

/**
 * @param {CanvasRenderingContext2D} ctx
 * @param {FaceDetection} detection
 * @returns {void}
 */
function drawDetection(ctx, detection) {
  const { originX, originY, width, height } = detection.boundingBox;
  const label = `Face - ${Math.round(detection.score * 100)}%`;

  ctx.strokeRect(originX, originY, width, height);
  drawLabel(ctx, label, originX, originY);
}

/**
 * @param {CanvasRenderingContext2D} ctx
 * @param {string} label
 * @param {number} x
 * @param {number} y
 * @returns {void}
 */
function drawLabel(ctx, label, x, y) {
  const metrics = ctx.measureText(label);
  const labelWidth = metrics.width + LABEL_PADDING_X * 2;
  const labelHeight = 14 + LABEL_PADDING_Y * 2;
  const labelY = Math.max(0, y - labelHeight);

  ctx.fillStyle = LABEL_BACKGROUND;
  ctx.fillRect(x, labelY, labelWidth, labelHeight);

  ctx.fillStyle = LABEL_COLOR;
  ctx.fillText(label, x + LABEL_PADDING_X, labelY + LABEL_PADDING_Y);
}
