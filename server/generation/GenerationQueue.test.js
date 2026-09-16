import assert from "node:assert/strict";
import { test } from "node:test";

import {
  GenerationSupersededError,
  createGenerationQueue,
} from "./GenerationQueue.js";

const config = Object.freeze({
  provider: "huggingface",
  model: "test-model",
  width: 16,
  height: 16,
});

function createRequest(prompt) {
  return {
    prompt,
    config,
  };
}

function createImage(prompt) {
  return {
    imageUrl: `memory://${prompt}`,
    generatedAt: 1,
    model: config.model,
  };
}

function createControlledImageGenerator() {
  const calls = [];

  return {
    calls,
    imageGenerator: {
      generate(request) {
        let resolve;
        let reject;
        const promise = new Promise((promiseResolve, promiseReject) => {
          resolve = promiseResolve;
          reject = promiseReject;
        });

        calls.push({ request, resolve, reject });

        return promise;
      },
    },
  };
}

test("coalesces simultaneous enqueue calls to active plus latest pending request", async () => {
  const { calls, imageGenerator } = createControlledImageGenerator();
  const queue = createGenerationQueue({ imageGenerator });

  const first = queue.enqueue(createRequest("first"));
  const second = queue.enqueue(createRequest("second"));
  const third = queue.enqueue(createRequest("third"));

  assert.equal(calls.length, 1);
  assert.equal(calls[0].request.prompt, "first");

  await assert.rejects(second, GenerationSupersededError);

  calls[0].resolve(createImage("first"));
  assert.deepEqual(await first, createImage("first"));

  await Promise.resolve();
  assert.equal(calls.length, 2);
  assert.equal(calls[1].request.prompt, "third");

  calls[1].resolve(createImage("third"));
  assert.deepEqual(await third, createImage("third"));
  assert.equal(calls.length, 2);
});

test("continues queue processing after image generator failure", async () => {
  const { calls, imageGenerator } = createControlledImageGenerator();
  const queue = createGenerationQueue({ imageGenerator });
  const error = new Error("generation failed");

  const first = queue.enqueue(createRequest("first"));
  const second = queue.enqueue(createRequest("second"));

  calls[0].reject(error);
  await assert.rejects(first, error);

  await Promise.resolve();
  assert.equal(calls.length, 2);
  assert.equal(calls[1].request.prompt, "second");

  calls[1].resolve(createImage("second"));
  assert.deepEqual(await second, createImage("second"));
});

test("processes sequential enqueue calls in order when each previous request finishes first", async () => {
  const { calls, imageGenerator } = createControlledImageGenerator();
  const queue = createGenerationQueue({ imageGenerator });

  const first = queue.enqueue(createRequest("first"));
  calls[0].resolve(createImage("first"));
  assert.deepEqual(await first, createImage("first"));

  const second = queue.enqueue(createRequest("second"));
  assert.equal(calls.length, 2);
  assert.equal(calls[1].request.prompt, "second");
  calls[1].resolve(createImage("second"));
  assert.deepEqual(await second, createImage("second"));

  const third = queue.enqueue(createRequest("third"));
  assert.equal(calls.length, 3);
  assert.equal(calls[2].request.prompt, "third");
  calls[2].resolve(createImage("third"));
  assert.deepEqual(await third, createImage("third"));
});
