/**
 * @typedef {import("../../shared/types.js").GenerateRequest} GenerateRequest
 * @typedef {import("../../shared/types.js").GeneratedImage} GeneratedImage
 * @typedef {import("../../shared/types.js").ImageGenerator} ImageGenerator
 */

const PLACEHOLDER_IMAGE_URL =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAAAXNSR0IArs4c6QAAAA1JREFUGFdjYGBg+A8AAQQBAHAgZQsAAAAASUVORK5CYII=";

/**
 * @implements {ImageGenerator}
 */
class MockImageGenerator {
  /**
   * @param {GenerateRequest} request
   * @returns {Promise<GeneratedImage>}
   */
  async generate(request) {
    return {
      imageUrl: PLACEHOLDER_IMAGE_URL,
      model: request.config.model,
      generatedAt: Date.now(),
    };
  }
}

/**
 * @returns {MockImageGenerator}
 */
export function createMockImageGenerator() {
  return new MockImageGenerator();
}
