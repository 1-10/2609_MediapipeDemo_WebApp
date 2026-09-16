import { readFileSync } from "node:fs";

import { getImageGenerationModel } from "../env.js";
import { GenerationSupersededError } from "../generation/GenerationQueue.js";
import {
  HuggingFaceApiError,
  MissingHfTokenError,
} from "../generation/HuggingFaceImageGenerator.js";

/** @typedef {import("../../shared/types.js").GenerateRequest} GenerateRequest */

const appConfig = JSON.parse(
  readFileSync(new URL("../../config/app.config.json", import.meta.url), "utf8"),
);
const imageGenerationConfig = Object.freeze({
  ...appConfig.imageGeneration,
  model: getImageGenerationModel() ?? appConfig.imageGeneration.model,
});

/**
 * @param {object} options
 * @param {{ enqueue(request: GenerateRequest): Promise<import("../../shared/types.js").GeneratedImage> }} options.generationQueue
 * @returns {(req: import("node:http").IncomingMessage, res: import("node:http").ServerResponse) => Promise<void>}
 */
export function createGenerateImageHandler({ generationQueue }) {
  return async (req, res) => {
    let body;

    try {
      body = await readJsonBody(req);
    } catch {
      sendJson(res, 400, { error: "Invalid JSON request body." });
      return;
    }

    if (typeof body?.prompt !== "string" || body.prompt.trim() === "") {
      sendJson(res, 400, { error: "A non-empty prompt is required." });
      return;
    }

    try {
      const image = await generationQueue.enqueue({
        prompt: body.prompt,
        config: imageGenerationConfig,
      });
      sendJson(res, 200, image);
    } catch (error) {
      if (error instanceof GenerationSupersededError) {
        sendJson(res, 409, { error: "Generation request was superseded." });
        return;
      }

      if (error instanceof MissingHfTokenError) {
        sendJson(res, 503, { error: "Image generation is currently unavailable." });
        return;
      }

      if (error instanceof HuggingFaceApiError) {
        sendJson(res, 502, { error: "Image generation service failed." });
        return;
      }

      sendJson(res, 502, { error: "Image generation failed." });
    }
  };
}

async function readJsonBody(req) {
  let rawBody = "";

  for await (const chunk of req) {
    rawBody += chunk;
  }

  return JSON.parse(rawBody);
}

function sendJson(res, statusCode, body) {
  res.statusCode = statusCode;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.end(JSON.stringify(body));
}
