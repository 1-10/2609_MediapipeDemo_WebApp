/**
 * @typedef {"idle" | "requesting" | "ready" | "denied" | "error"} CameraStateValue
 */

/**
 * @typedef {"idle" | "generating" | "success" | "error"} GenerationStatusValue
 */

export const CameraState = Object.freeze({
  idle: "idle",
  requesting: "requesting",
  ready: "ready",
  denied: "denied",
  error: "error",
});

export const GenerationStatus = Object.freeze({
  idle: "idle",
  generating: "generating",
  success: "success",
  error: "error",
});

/**
 * @typedef {object} FrameContext
 * @property {number} frameId
 * @property {number} timestampMs
 */

/**
 * @typedef {object} BoundingBox
 * @property {number} originX
 * @property {number} originY
 * @property {number} width
 * @property {number} height
 */

/**
 * @typedef {object} FaceDetection
 * @property {BoundingBox} boundingBox
 * @property {number} score
 */

/**
 * @typedef {object} SegmentationMask
 * @property {number} width
 * @property {number} height
 * @property {(x: number, y: number) => number} getPersonProbability
 */

/**
 * @typedef {object} Mode1FrameState
 * @property {number} frameId
 * @property {number} timestampMs
 * @property {HTMLVideoElement} sourceFrame
 * @property {FaceDetection[]} faceDetections
 * @property {SegmentationMask} [personMask]
 */

/**
 * @typedef {object} SemanticObject
 * @property {string} label
 * @property {number} [count]
 * @property {"left" | "center" | "right"} [position]
 * @property {"small" | "medium" | "large"} [size]
 * @property {string[]} [attributes]
 */

/**
 * @typedef {object} SemanticPacket
 * @property {number} timestampMs
 * @property {{ environment?: string, layout?: string }} [scene]
 * @property {SemanticObject[]} objects
 */

/**
 * @typedef {object} ImageGenerationConfig
 * @property {"huggingface"} provider
 * @property {string} model
 * @property {number} width
 * @property {number} height
 * @property {string} [stylePreset]
 */

/**
 * @typedef {object} GenerateRequest
 * @property {string} prompt
 * @property {ImageGenerationConfig} config
 */

/**
 * @typedef {object} GeneratedImage
 * @property {string} imageUrl
 * @property {number} generatedAt
 * @property {string} model
 */

/**
 * @typedef {object} ImageGenerator
 * @property {(req: GenerateRequest) => Promise<GeneratedImage>} generate
 */
