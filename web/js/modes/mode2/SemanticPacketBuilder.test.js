import assert from "node:assert/strict";
import test from "node:test";

import { buildPacket } from "./SemanticPacketBuilder.js";

test("buildPacket returns an empty objects array for no detections", () => {
  assert.deepEqual(buildPacket([], 640, 480, 1000), {
    timestampMs: 1000,
    objects: [],
  });
});

test("buildPacket maps a single detection to a semantic object", () => {
  const packet = buildPacket(
    [
      {
        label: "person",
        score: 0.93,
        boundingBox: { originX: 220, originY: 40, width: 200, height: 300 },
      },
    ],
    640,
    480,
    2000,
  );

  assert.deepEqual(packet, {
    timestampMs: 2000,
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

test("buildPacket groups detections with the same label and keeps the first position and size", () => {
  const packet = buildPacket(
    [
      {
        label: "person",
        score: 0.92,
        boundingBox: { originX: 20, originY: 30, width: 80, height: 80 },
      },
      {
        label: "person",
        score: 0.88,
        boundingBox: { originX: 500, originY: 40, width: 220, height: 260 },
      },
    ],
    900,
    600,
    3000,
  );

  assert.deepEqual(packet, {
    timestampMs: 3000,
    objects: [
      {
        label: "person",
        count: 2,
        position: "left",
        size: "small",
      },
    ],
  });
});

test("buildPacket preserves first-seen label order for multiple labels", () => {
  const packet = buildPacket(
    [
      {
        label: "chair",
        score: 0.8,
        boundingBox: { originX: 650, originY: 220, width: 120, height: 120 },
      },
      {
        label: "bottle",
        score: 0.74,
        boundingBox: { originX: 275, originY: 250, width: 50, height: 120 },
      },
      {
        label: "chair",
        score: 0.72,
        boundingBox: { originX: 30, originY: 250, width: 120, height: 120 },
      },
    ],
    900,
    600,
    4000,
  );

  assert.deepEqual(packet, {
    timestampMs: 4000,
    objects: [
      {
        label: "chair",
        count: 2,
        position: "right",
        size: "small",
      },
      {
        label: "bottle",
        count: 1,
        position: "center",
        size: "small",
      },
    ],
  });
});
