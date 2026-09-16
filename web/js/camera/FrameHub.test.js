import assert from "node:assert/strict";
import test from "node:test";

import { FrameHub } from "./FrameHub.js";

function installAnimationFrameStubs(t) {
  const originalRequestAnimationFrame = globalThis.requestAnimationFrame;
  const originalCancelAnimationFrame = globalThis.cancelAnimationFrame;
  let nextAnimationFrameId = 1;

  globalThis.requestAnimationFrame = () => nextAnimationFrameId++;
  globalThis.cancelAnimationFrame = () => {};

  t.after(() => {
    if (originalRequestAnimationFrame === undefined) {
      delete globalThis.requestAnimationFrame;
    } else {
      globalThis.requestAnimationFrame = originalRequestAnimationFrame;
    }

    if (originalCancelAnimationFrame === undefined) {
      delete globalThis.cancelAnimationFrame;
    } else {
      globalThis.cancelAnimationFrame = originalCancelAnimationFrame;
    }
  });
}

test("getFramesPerSecond returns zero until two ticks are available", (t) => {
  installAnimationFrameStubs(t);
  const frameHub = new FrameHub({});

  assert.equal(frameHub.getFramesPerSecond(), 0);

  frameHub.start();
  frameHub.tick(100);

  assert.equal(frameHub.getFramesPerSecond(), 0);
});

test("getFramesPerSecond measures manually-ticked frames over one second", (t) => {
  installAnimationFrameStubs(t);
  const frameHub = new FrameHub({});
  frameHub.start();

  for (let frameIndex = 0; frameIndex <= 30; frameIndex += 1) {
    frameHub.tick(100 + frameIndex * (1_000 / 30));
  }

  assert.ok(Math.abs(frameHub.getFramesPerSecond() - 30) < 0.001);
});

test("getFramesPerSecond excludes ticks older than one second", (t) => {
  installAnimationFrameStubs(t);
  const frameHub = new FrameHub({});
  frameHub.start();

  for (let frameIndex = 0; frameIndex <= 10; frameIndex += 1) {
    frameHub.tick(100 + frameIndex * 100);
  }
  for (let frameIndex = 1; frameIndex <= 20; frameIndex += 1) {
    frameHub.tick(1_100 + frameIndex * 50);
  }

  assert.ok(Math.abs(frameHub.getFramesPerSecond() - 20) < 0.001);
});

test("FPS tracking preserves frame data and subscriber notification order", (t) => {
  installAnimationFrameStubs(t);
  const frameHub = new FrameHub({});
  const notifications = [];

  frameHub.subscribe((frameContext) => {
    notifications.push(["first", frameContext]);
  });
  frameHub.subscribe((frameContext) => {
    notifications.push(["second", frameContext]);
  });

  frameHub.start();
  frameHub.tick(200);
  frameHub.tick(150);

  assert.deepEqual(notifications, [
    ["first", { frameId: 0, timestampMs: 200 }],
    ["second", { frameId: 0, timestampMs: 200 }],
    ["first", { frameId: 1, timestampMs: 200.001 }],
    ["second", { frameId: 1, timestampMs: 200.001 }],
  ]);
});
