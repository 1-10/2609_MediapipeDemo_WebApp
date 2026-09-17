import { getHfToken, isHfApiDisabled } from "../server/env.js";
import { createGenerationQueue } from "../server/generation/GenerationQueue.js";
import { createHuggingFaceImageGenerator } from "../server/generation/HuggingFaceImageGenerator.js";
import { createMockImageGenerator } from "../server/generation/MockImageGenerator.js";
import { createGenerateImageHandler } from "../server/routes/generateImage.js";

const imageGenerator = isHfApiDisabled()
  ? createMockImageGenerator()
  : createHuggingFaceImageGenerator({ hfToken: getHfToken() });
const generationQueue = createGenerationQueue({ imageGenerator });
const generateImageHandler = createGenerateImageHandler({ generationQueue });

export default async function handler(req, res) {
  await generateImageHandler(req, res);
}
