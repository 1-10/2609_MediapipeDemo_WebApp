import { createServer } from 'node:http';

import { getHfToken, getPort } from './env.js';
import { createGenerationQueue } from './generation/GenerationQueue.js';
import { createHuggingFaceImageGenerator } from './generation/HuggingFaceImageGenerator.js';
import { createGenerateImageHandler } from './routes/generateImage.js';
import { createStaticHandler } from './staticServer.js';

const port = getPort();
const staticHandler = createStaticHandler();
const imageGenerator = createHuggingFaceImageGenerator({ hfToken: getHfToken() });
const generationQueue = createGenerationQueue({ imageGenerator });
const generateImageHandler = createGenerateImageHandler({ generationQueue });

const server = createServer((req, res) => {
  const pathname = new URL(req.url ?? '/', 'http://localhost').pathname;

  if (req.method === 'POST' && pathname === '/api/generate-image') {
    void generateImageHandler(req, res);
    return;
  }

  if (req.method !== 'GET' && req.method !== 'HEAD') {
    res.statusCode = 404;
    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    res.end('Not Found');
    return;
  }

  staticHandler(req, res);
});

server.listen(port, () => {
  console.log(`Server listening on port ${port}`);
});
