import assert from "node:assert/strict";
import test from "node:test";

import { createSemanticExtractor } from "./SemanticExtractor.js";

const config = Object.freeze({
  objectDetector: Object.freeze({
    inferenceIntervalMs: 300,
  }),
  semantic: Object.freeze({
    updateIntervalMs: 100,
  }),
});

const video = Object.freeze({
  videoWidth: 640,
  videoHeight: 480,
});

test("getLatestPacket returns null before the first extraction completes", () => {
  const extractor = createSemanticExtractor({
    objectDetectorService: createDetector(() => []),
    config,
  });

  assert.equal(extractor.getLatestPacket(), null);
});

test("tick builds and stores a semantic packet from object detections", async () => {
  const extractor = createSemanticExtractor({
    objectDetectorService: createDetector(() => [
      {
        label: "person",
        score: 0.9,
        boundingBox: { originX: 200, originY: 40, width: 200, height: 300 },
      },
    ]),
    config,
  });

  extractor.tick(video, 1000);
  await flushPromises();

  assert.deepEqual(extractor.getLatestPacket(), {
    timestampMs: 1000,
    objects: [
      {
        label: "person",
        count: 1,
        position: "center",
        size: "medium",
      },
    ],
  });
});

test("tick throttles detection calls by semantic update interval", async () => {
  const detector = createDetector(() => []);
  const extractor = createSemanticExtractor({
    objectDetectorService: detector,
    config,
  });

  extractor.tick(video, 0);
  await flushPromises();
  extractor.tick(video, 99);
  await flushPromises();
  extractor.tick(video, 100);
  await flushPromises();

  assert.deepEqual(detector.calls, [
    { videoEl: video, timestampMs: 0 },
    { videoEl: video, timestampMs: 100 },
  ]);
});

test("tick skips while a detection is still busy and does not queue missed ticks", async () => {
  const pendingDetection = createPendingDetection();
  const detector = createDetector(() => pendingDetection.promise);
  const extractor = createSemanticExtractor({
    objectDetectorService: detector,
    config,
  });

  extractor.tick(video, 0);
  await Promise.resolve();
  extractor.tick(video, 200);

  assert.equal(detector.calls.length, 1);

  pendingDetection.resolve([]);
  await flushPromises();

  assert.equal(detector.calls.length, 1);

  extractor.tick(video, 201);
  await flushPromises();

  assert.deepEqual(detector.calls, [
    { videoEl: video, timestampMs: 0 },
    { videoEl: video, timestampMs: 201 },
  ]);
});

test("tick keeps the previous semantic packet when detection fails", async () => {
  const successfulDetection = [
    {
      label: "chair",
      score: 0.8,
      boundingBox: { originX: 20, originY: 20, width: 80, height: 80 },
    },
  ];
  const detector = createDetector((timestampMs) => {
    if (timestampMs === 0) {
      return successfulDetection;
    }

    throw new Error("Object detector failed");
  });
  const extractor = createSemanticExtractor({
    objectDetectorService: detector,
    config,
  });

  extractor.tick(video, 0);
  await flushPromises();
  const previousPacket = extractor.getLatestPacket();

  extractor.tick(video, 100);
  await flushPromises();

  assert.deepEqual(extractor.getLatestPacket(), previousPacket);
});

/**
 * @param {(timestampMs: number) => import("../../../../shared/types.js").ObjectDetection[] | Promise<import("../../../../shared/types.js").ObjectDetection[]>} detect
 */
function createDetector(detect) {
  return {
    calls: [],
    detectForVideo(videoEl, timestampMs) {
      this.calls.push({ videoEl, timestampMs });
      return detect(timestampMs);
    },
  };
}

function createPendingDetection() {
  /** @type {(detections: import("../../../../shared/types.js").ObjectDetection[]) => void} */
  let resolve;
  const promise = new Promise((promiseResolve) => {
    resolve = promiseResolve;
  });

  return { promise, resolve };
}

async function flushPromises() {
  for (let i = 0; i < 6; i += 1) {
    await Promise.resolve();
  }
}
