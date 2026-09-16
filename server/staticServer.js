import { readFile, stat } from 'node:fs/promises';
import { dirname, extname, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const serverDir = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(serverDir, '..');

const roots = {
  web: resolve(repoRoot, 'web'),
  config: resolve(repoRoot, 'config'),
  shared: resolve(repoRoot, 'shared'),
};

const contentTypes = new Map([
  ['.html', 'text/html; charset=utf-8'],
  ['.js', 'text/javascript; charset=utf-8'],
  ['.mjs', 'text/javascript; charset=utf-8'],
  ['.css', 'text/css; charset=utf-8'],
  ['.json', 'application/json; charset=utf-8'],
  ['.wasm', 'application/wasm'],
  ['.map', 'application/json; charset=utf-8'],
]);

/**
 * @returns {(req: import('node:http').IncomingMessage, res: import('node:http').ServerResponse) => void}
 */
export function createStaticHandler() {
  return (req, res) => {
    if (req.method !== 'GET' && req.method !== 'HEAD') {
      return;
    }

    serveStaticFile(req, res).catch(() => {
      sendNotFound(res);
    });
  };
}

async function serveStaticFile(req, res) {
  const target = resolveRequestTarget(req.url);

  if (!target) {
    sendNotFound(res);
    return;
  }

  const fileStat = await stat(target.filePath).catch(() => null);

  if (!fileStat?.isFile()) {
    sendNotFound(res);
    return;
  }

  const contentType = contentTypes.get(extname(target.filePath));
  if (contentType) {
    res.setHeader('Content-Type', contentType);
  }
  res.statusCode = 200;

  if (req.method === 'HEAD') {
    res.end();
    return;
  }

  const body = await readFile(target.filePath);
  res.end(body);
}

function resolveRequestTarget(rawUrl = '/') {
  let pathname;

  try {
    pathname = decodeURIComponent(new URL(rawUrl, 'http://localhost').pathname);
  } catch {
    return null;
  }

  if (pathname.includes('\0')) {
    return null;
  }

  if (pathname.startsWith('/config/')) {
    return resolveInsideRoot(roots.config, pathname.slice('/config/'.length));
  }

  if (pathname.startsWith('/shared/')) {
    return resolveInsideRoot(roots.shared, pathname.slice('/shared/'.length));
  }

  if (pathname === '/') {
    return resolveInsideRoot(roots.web, 'index.html');
  }

  return resolveInsideRoot(roots.web, pathname.slice(1));
}

function resolveInsideRoot(root, relativePath) {
  const segments = relativePath.split('/').filter(Boolean);

  if (segments.some((segment) => segment === '..')) {
    return null;
  }

  const filePath = resolve(root, ...segments);
  const rootPrefix = root.endsWith(sep) ? root : `${root}${sep}`;

  if (filePath !== root && !filePath.startsWith(rootPrefix)) {
    return null;
  }

  return { filePath };
}

function sendNotFound(res) {
  if (res.headersSent) {
    res.end();
    return;
  }

  res.statusCode = 404;
  res.setHeader('Content-Type', 'text/plain; charset=utf-8');
  res.end('Not Found');
}
