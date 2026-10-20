'use strict';
const fs = require('fs');
const http = require('http');
const path = require('path');

const mime = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.otf': 'font/otf',
};

function startServer(root) {
  const base = path.resolve(root);
  return new Promise((resolve, reject) => {
    const server = http.createServer((request, response) => {
      let pathname;
      try {
        pathname = decodeURIComponent(new URL(request.url, 'http://127.0.0.1').pathname);
      } catch {
        response.writeHead(400).end('Bad request');
        return;
      }
      if (pathname === '/') pathname = '/index.html';
      const file = path.resolve(base, `.${pathname}`);
      if (!file.startsWith(`${base}${path.sep}`)) {
        response.writeHead(403).end('Forbidden');
        return;
      }
      fs.stat(file, (error, stat) => {
        if (error || !stat.isFile()) {
          response.writeHead(404).end('Not found');
          return;
        }
        response.writeHead(200, {
          'content-type': mime[path.extname(file).toLowerCase()] || 'application/octet-stream',
          'cache-control': 'no-store',
          'content-length': stat.size,
        });
        fs.createReadStream(file).pipe(response);
      });
    });
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => {
      const { port } = server.address();
      resolve({
        origin: `http://127.0.0.1:${port}`,
        close: () => new Promise(done => server.close(done)),
      });
    });
  });
}

module.exports = { startServer };
