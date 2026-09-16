import { createServer } from 'node:http';

import { getPort } from './env.js';
import { createStaticHandler } from './staticServer.js';

const port = getPort();
const staticHandler = createStaticHandler();

const server = createServer((req, res) => {
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
