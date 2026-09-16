import assert from "node:assert/strict";
import test from "node:test";

import { buildPrompt } from "./PromptBuilder.js";

const imageGenerationConfig = Object.freeze({
  provider: "huggingface",
  model: "black-forest-labs/FLUX.1-schnell",
  width: 512,
  height: 512,
  stylePreset: "simple flat illustration, clean anime-like rendering",
});

test("buildPrompt returns a style-only prompt when objects are empty", () => {
  const prompt = buildPrompt(
    {
      timestampMs: 1000,
      objects: [],
    },
    imageGenerationConfig,
  );

  assert.equal(
    prompt,
    "A semantic reconstruction of the detected scene. Style: simple flat illustration, clean anime-like rendering.",
  );
});

test("buildPrompt includes one object's label, count, position, size, attributes, and scene", () => {
  const prompt = buildPrompt(
    {
      timestampMs: 1000,
      scene: {
        environment: "indoor room",
        layout: "single subject centered",
      },
      objects: [
        {
          label: "person",
          count: 1,
          position: "center",
          size: "large",
          attributes: ["dark top", "raising right hand"],
        },
      ],
    },
    imageGenerationConfig,
  );

  assert.equal(
    prompt,
    "A semantic reconstruction featuring one large person in the center with dark top and raising right hand. Scene context includes environment: indoor room and layout: single subject centered. Style: simple flat illustration, clean anime-like rendering.",
  );
});

test("buildPrompt includes multiple objects deterministically", () => {
  const semanticPacket = {
    timestampMs: 1000,
    scene: {
      environment: "indoor",
    },
    objects: [
      {
        label: "bottle",
        count: 2,
        position: "left",
        size: "small",
      },
      {
        label: "display",
        count: 1,
        position: "right",
        size: "medium",
        attributes: ["background"],
      },
      {
        label: "chair",
        count: 3,
        size: "large",
      },
    ],
  };

  const firstPrompt = buildPrompt(semanticPacket, imageGenerationConfig);
  const secondPrompt = buildPrompt(semanticPacket, imageGenerationConfig);

  assert.equal(firstPrompt, secondPrompt);
  assert.equal(
    firstPrompt,
    "A semantic reconstruction featuring two small bottles in the left, one medium display in the right with background, and three large chairs. Scene context includes environment: indoor. Style: simple flat illustration, clean anime-like rendering.",
  );
});
