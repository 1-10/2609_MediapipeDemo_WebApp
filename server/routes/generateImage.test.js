import assert from "node:assert/strict";
import { Readable } from "node:stream";
import { test } from "node:test";

import { GenerationSupersededError } from "../generation/GenerationQueue.js";
import {
  HuggingFaceApiError,
  MissingHfTokenError,
} from "../generation/HuggingFaceImageGenerator.js";
import { createGenerateImageHandler } from "./generateImage.js";

function createRequest(body) {
  return Readable.from([body]);
}

function createResponse() {
  const headers = new Map();

  return {
    statusCode: 0,
    body: "",
    setHeader(name, value) {
      headers.set(name.toLowerCase(), value);
    },
    getHeader(name) {
      return headers.get(name.toLowerCase());
    },
    end(body = "") {
      this.body = body;
    },
  };
}

async function invoke({ body, enqueue }) {
  const handler = createGenerateImageHandler({
    generationQueue: { enqueue },
  });
  const response = createResponse();

  await handler(createRequest(body), response);

  return {
    response,
    json: JSON.parse(response.body),
  };
}

test("enqueues the prompt with server-owned image generation config", async () => {
  const requests = [];
  const generatedImage = {
    imageUrl: "data:image/png;base64,test",
    generatedAt: 123,
    model: "black-forest-labs/FLUX.1-schnell",
  };
  const { response, json } = await invoke({
    body: JSON.stringify({
      prompt: "A quiet room",
      model: "client-model",
      width: 1,
      height: 1,
      provider: "client-provider",
      stylePreset: "client-style",
    }),
    async enqueue(request) {
      requests.push(request);
      return generatedImage;
    },
  });

  assert.equal(response.statusCode, 200);
  assert.equal(response.getHeader("content-type"), "application/json; charset=utf-8");
  assert.deepEqual(json, generatedImage);
  assert.deepEqual(requests, [
    {
      prompt: "A quiet room",
      config: {
        provider: "huggingface",
        model: "black-forest-labs/FLUX.1-schnell",
        width: 512,
        height: 512,
        stylePreset: "simple flat illustration, clean anime-like rendering",
      },
    },
  ]);
});

for (const [name, body] of [
  ["malformed JSON", "{"],
  ["missing prompt", "{}"],
  ["non-string prompt", JSON.stringify({ prompt: 42 })],
  ["empty prompt", JSON.stringify({ prompt: "  " })],
]) {
  test(`returns JSON 400 for ${name}`, async () => {
    let enqueueCalled = false;
    const { response, json } = await invoke({
      body,
      async enqueue() {
        enqueueCalled = true;
      },
    });

    assert.equal(response.statusCode, 400);
    assert.equal(response.getHeader("content-type"), "application/json; charset=utf-8");
    assert.equal(typeof json.error, "string");
    assert.equal(enqueueCalled, false);
  });
}

for (const [name, error, expectedStatus] of [
  ["superseded requests", new GenerationSupersededError(), 409],
  ["missing HF token", new MissingHfTokenError("secret-token"), 503],
  ["Hugging Face API failures", new HuggingFaceApiError("secret-token"), 502],
  ["unexpected generation failures", new Error("secret-token"), 502],
]) {
  test(`returns JSON ${expectedStatus} for ${name} without leaking error details`, async () => {
    const { response, json } = await invoke({
      body: JSON.stringify({ prompt: "A quiet room" }),
      async enqueue() {
        throw error;
      },
    });

    assert.equal(response.statusCode, expectedStatus);
    assert.equal(response.getHeader("content-type"), "application/json; charset=utf-8");
    assert.equal(typeof json.error, "string");
    assert.equal(response.body.includes("secret-token"), false);
  });
}
