import assert from "node:assert/strict";
import { test } from "node:test";

import {
  HuggingFaceApiError,
  MissingHfTokenError,
  createHuggingFaceImageGenerator,
} from "./HuggingFaceImageGenerator.js";

const request = Object.freeze({
  prompt: "A person standing in an indoor room.",
  config: Object.freeze({
    provider: "huggingface",
    model: "test-model",
    width: 640,
    height: 480,
  }),
});

test("rejects without creating an SDK client when the HF token is missing", async () => {
  let clientCreated = false;
  const generator = createHuggingFaceImageGenerator({
    hfToken: undefined,
    createClient() {
      clientCreated = true;
      return { textToImage() {} };
    },
  });

  await assert.rejects(generator.generate(request), MissingHfTokenError);
  assert.equal(clientCreated, false);
});

test("converts the generated Blob to a PNG data URL", async () => {
  const calls = [];
  const imageBytes = Uint8Array.from([137, 80, 78, 71]);
  const generator = createHuggingFaceImageGenerator({
    hfToken: "test-token",
    createClient(token) {
      assert.equal(token, "test-token");
      return {
        async textToImage(options) {
          calls.push(options);
          return new Blob([imageBytes], { type: "image/png" });
        },
      };
    },
  });
  const beforeGeneration = Date.now();

  const result = await generator.generate(request);

  assert.deepEqual(calls, [
    {
      model: "test-model",
      provider: "auto",
      inputs: request.prompt,
      parameters: { width: 640, height: 480 },
    },
  ]);
  assert.equal(result.imageUrl, "data:image/png;base64,iVBORw==");
  assert.equal(result.model, "test-model");
  assert.ok(result.generatedAt >= beforeGeneration);
  assert.ok(result.generatedAt <= Date.now());
});

test("wraps SDK failures in a distinguishable API error", async () => {
  const sdkError = new Error("rate limited");
  const generator = createHuggingFaceImageGenerator({
    hfToken: "test-token",
    createClient() {
      return {
        async textToImage() {
          throw sdkError;
        },
      };
    },
  });

  await assert.rejects(generator.generate(request), (error) => {
    assert.ok(error instanceof HuggingFaceApiError);
    assert.equal(error.message, "Hugging Face image generation failed.");
    assert.equal(error.cause, sdkError);
    return true;
  });
});
