import { InferenceClient } from "@huggingface/inference";

/**
 * @typedef {import("../../shared/types.js").GenerateRequest} GenerateRequest
 * @typedef {import("../../shared/types.js").GeneratedImage} GeneratedImage
 * @typedef {import("../../shared/types.js").ImageGenerator} ImageGenerator
 */

export class MissingHfTokenError extends Error {
  constructor(message = "Hugging Face token is not configured.") {
    super(message);
    this.name = "MissingHfTokenError";
  }
}

export class HuggingFaceApiError extends Error {
  constructor(message = "Hugging Face image generation failed.", options) {
    super(message, options);
    this.name = "HuggingFaceApiError";
  }
}

/**
 * @implements {ImageGenerator}
 */
export class HuggingFaceImageGenerator {
  /**
   * @param {object} options
   * @param {string | undefined} options.hfToken
   * @param {(hfToken: string) => Pick<InferenceClient, "textToImage">} [options.createClient]
   */
  constructor({
    hfToken,
    createClient = (token) => new InferenceClient(token),
  }) {
    this.hfToken = hfToken;
    this.createClient = createClient;
  }

  /**
   * @param {GenerateRequest} request
   * @returns {Promise<GeneratedImage>}
   */
  async generate(request) {
    if (this.hfToken === undefined) {
      throw new MissingHfTokenError();
    }

    try {
      const client = this.createClient(this.hfToken);
      const image = await client.textToImage({
        model: request.config.model,
        provider: "auto",
        inputs: request.prompt,
        parameters: {
          width: request.config.width,
          height: request.config.height,
        },
      });
      const imageBytes = Buffer.from(await image.arrayBuffer());

      return {
        imageUrl: `data:image/png;base64,${imageBytes.toString("base64")}`,
        generatedAt: Date.now(),
        model: request.config.model,
      };
    } catch (cause) {
      throw new HuggingFaceApiError(undefined, { cause });
    }
  }
}

/**
 * @param {ConstructorParameters<typeof HuggingFaceImageGenerator>[0]} options
 * @returns {HuggingFaceImageGenerator}
 */
export function createHuggingFaceImageGenerator(options) {
  return new HuggingFaceImageGenerator(options);
}
