/**
 * @typedef {import("../../../../shared/types.js").SegmentationMask} SegmentationMask
 *
 * @typedef {object} SegmentationRenderConfig
 * @property {number} threshold
 * @property {string} silhouetteColor
 * @property {string} backgroundColor
 */

const COLOR_SAMPLE_SIZE = 1;

/**
 * Draws a thresholded person segmentation mask as a binary silhouette.
 *
 * @param {CanvasRenderingContext2D} ctx
 * @param {SegmentationMask} mask
 * @param {SegmentationRenderConfig} config
 * @returns {void}
 */
export function draw(ctx, mask, config) {
  const { width, height } = mask;
  const silhouette = parseCanvasColor(ctx, config.silhouetteColor);
  ctx.fillStyle = config.backgroundColor;
  ctx.fillRect(0, 0, width, height);

  const image = ctx.getImageData(0, 0, width, height);
  const { data } = image;

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      if (mask.getPersonProbability(x, y) < config.threshold) {
        continue;
      }

      const offset = (y * width + x) * 4;
      data[offset] = silhouette[0];
      data[offset + 1] = silhouette[1];
      data[offset + 2] = silhouette[2];
      data[offset + 3] = silhouette[3];
    }
  }

  ctx.putImageData(image, 0, 0);
}

/**
 * @param {CanvasRenderingContext2D} ctx
 * @param {string} color
 * @returns {[number, number, number, number]}
 */
function parseCanvasColor(ctx, color) {
  const canvas = ctx.canvas.ownerDocument.createElement("canvas");
  canvas.width = COLOR_SAMPLE_SIZE;
  canvas.height = COLOR_SAMPLE_SIZE;

  const colorCtx = canvas.getContext("2d");
  colorCtx.clearRect(0, 0, COLOR_SAMPLE_SIZE, COLOR_SAMPLE_SIZE);
  colorCtx.fillStyle = color;
  colorCtx.fillRect(0, 0, COLOR_SAMPLE_SIZE, COLOR_SAMPLE_SIZE);

  const [red, green, blue, alpha] = colorCtx.getImageData(
    0,
    0,
    COLOR_SAMPLE_SIZE,
    COLOR_SAMPLE_SIZE,
  ).data;

  return [red, green, blue, alpha];
}
