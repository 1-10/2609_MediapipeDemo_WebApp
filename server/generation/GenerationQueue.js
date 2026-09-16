/**
 * @typedef {import("../../shared/types.js").GenerateRequest} GenerateRequest
 * @typedef {import("../../shared/types.js").GeneratedImage} GeneratedImage
 * @typedef {import("../../shared/types.js").ImageGenerator} ImageGenerator
 */

export class GenerationSupersededError extends Error {
  constructor(message = "Generation request was superseded by a newer request.") {
    super(message);
    this.name = "GenerationSupersededError";
  }
}

/**
 * @param {{ imageGenerator: ImageGenerator }} options
 * @returns {{ enqueue(request: GenerateRequest): Promise<GeneratedImage> }}
 */
export function createGenerationQueue({ imageGenerator }) {
  let active = false;
  /** @type {{ request: GenerateRequest, resolve: (image: GeneratedImage) => void, reject: (error: unknown) => void } | null} */
  let pending = null;

  const run = async (entry) => {
    active = true;

    let result;
    let failed = false;

    try {
      result = await imageGenerator.generate(entry.request);
    } catch (error) {
      result = error;
      failed = true;
    }

    const next = pending;
    pending = null;

    if (next) {
      run(next);
    } else {
      active = false;
    }

    if (failed) {
      entry.reject(result);
      return;
    }

    entry.resolve(result);
  };

  return {
    enqueue(request) {
      return new Promise((resolve, reject) => {
        const entry = { request, resolve, reject };

        if (!active) {
          run(entry);
          return;
        }

        if (pending) {
          pending.reject(new GenerationSupersededError());
        }

        pending = entry;
      });
    },
  };
}
