import assert from "node:assert/strict";
import { Readable } from "node:stream";
import { afterEach, test } from "node:test";

import { getImageGenerationModel, isHfApiDisabled } from "./env.js";

const originalDisableHfApi = process.env.DISABLE_HF_API;
const originalHfImageModel = process.env.HF_IMAGE_MODEL;

afterEach(() => {
  restoreEnv("DISABLE_HF_API", originalDisableHfApi);
  restoreEnv("HF_IMAGE_MODEL", originalHfImageModel);
});

test('isHfApiDisabled returns true only for the exact string "1"', () => {
  for (const value of [undefined, "0", "true", "yes", "", "01"]) {
    setEnv("DISABLE_HF_API", value);
    assert.equal(isHfApiDisabled(), false, `expected false for ${String(value)}`);
  }

  process.env.DISABLE_HF_API = "1";
  assert.equal(isHfApiDisabled(), true);
});

test("getImageGenerationModel returns undefined for unset or empty values", () => {
  delete process.env.HF_IMAGE_MODEL;
  assert.equal(getImageGenerationModel(), undefined);

  process.env.HF_IMAGE_MODEL = "";
  assert.equal(getImageGenerationModel(), undefined);

  process.env.HF_IMAGE_MODEL = "organization/custom-model";
  assert.equal(getImageGenerationModel(), "organization/custom-model");
});

test("generate image route prefers the environment model over app config", async () => {
  process.env.HF_IMAGE_MODEL = "organization/env-model";
  const { createGenerateImageHandler } = await import(
    `./routes/generateImage.js?env-model-test=${Date.now()}`
  );
  let enqueuedRequest;
  const handler = createGenerateImageHandler({
    generationQueue: {
      async enqueue(request) {
        enqueuedRequest = request;
        return {
          imageUrl: "data:image/png;base64,test",
          generatedAt: 1,
          model: request.config.model,
        };
      },
    },
  });
  const response = createResponse();

  await handler(Readable.from([JSON.stringify({ prompt: "A quiet room" })]), response);

  assert.equal(response.statusCode, 200);
  assert.equal(enqueuedRequest.config.model, "organization/env-model");
});

function setEnv(name, value) {
  if (value === undefined) {
    delete process.env[name];
    return;
  }

  process.env[name] = value;
}

function restoreEnv(name, value) {
  setEnv(name, value);
}

function createResponse() {
  return {
    statusCode: 0,
    setHeader() {},
    end(body = "") {
      this.body = body;
    },
  };
}
