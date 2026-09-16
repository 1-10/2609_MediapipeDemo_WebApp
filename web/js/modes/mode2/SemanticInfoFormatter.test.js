import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { formatSemanticLines } from "./SemanticInfoFormatter.js";

describe("formatSemanticLines", () => {
  it("returns an empty array when there are no semantic objects", () => {
    assert.deepEqual(
      formatSemanticLines({
        timestampMs: 123456,
        objects: [],
      }),
      [],
    );
  });

  it("formats semantic objects into flat display lines", () => {
    assert.deepEqual(
      formatSemanticLines({
        timestampMs: 123456,
        scene: {
          environment: "indoor",
        },
        objects: [
          {
            label: "person",
            count: 1,
            position: "center",
            size: "large",
            attributes: ["dark shirt", "raising right hand"],
          },
          {
            label: "display",
            count: 1,
          },
        ],
      }),
      [
        "person",
        "center",
        "large",
        "dark shirt",
        "raising right hand",
        "display",
        "indoor",
      ],
    );
  });

  it("includes object counts only when the count is greater than one", () => {
    assert.deepEqual(
      formatSemanticLines({
        timestampMs: 123456,
        objects: [
          {
            label: "person",
            count: 2,
          },
          {
            label: "chair",
            count: 1,
          },
          {
            label: "table",
          },
        ],
      }),
      ["person x2", "chair", "table"],
    );
  });

  it("includes optional scene layout after object details", () => {
    assert.deepEqual(
      formatSemanticLines({
        timestampMs: 123456,
        scene: {
          environment: "indoor",
          layout: "single subject centered",
        },
        objects: [
          {
            label: "person",
          },
        ],
      }),
      ["person", "indoor", "single subject centered"],
    );
  });
});
