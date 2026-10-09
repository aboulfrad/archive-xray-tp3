import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../dist');
const types = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.zip': 'application/zip',
  '.json': 'application/json',
};
const server = http.createServer((req, res) => {
  res.setHeader(
    'Content-Security-Policy',
    "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' blob: data:; worker-src 'self'; connect-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'; form-action 'none'",
  );
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'no-referrer');
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  if (!['GET', 'HEAD'].includes(req.method)) {
    res.writeHead(405, { Allow: 'GET, HEAD' });
    res.end();
    return;
  }
  let pathname;
  try {
    pathname = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
  } catch {
    res.writeHead(400);
    res.end('Requête invalide');
    return;
  }
  if (pathname === '/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ status: 'ok', app: 'archive-xray' }));
    return;
  }
  const filename = path.resolve(root, '.' + pathname);
  if (pathname.includes('\0') || (filename !== root && !filename.startsWith(root + path.sep))) {
    res.writeHead(403);
    res.end();
    return;
  }
  let target = filename;
  try {
    if (!fs.statSync(target).isFile()) target = path.join(root, 'index.html');
  } catch {
    if (path.extname(pathname)) {
      res.writeHead(404);
      res.end('Fichier introuvable');
      return;
    }
    target = path.join(root, 'index.html');
  }
  try {
    const stat = fs.statSync(target);
    res.writeHead(200, {
      'Content-Type': types[path.extname(target)] ?? 'application/octet-stream',
      'Content-Length': stat.size,
      'Cache-Control': target.includes('/assets/')
        ? 'public, max-age=31536000, immutable'
        : 'no-cache',
    });
    if (req.method === 'HEAD') res.end();
    else fs.createReadStream(target).pipe(res);
  } catch {
    res.writeHead(503);
    res.end('Le build de l’application est absent. Lancez npm run build.');
  }
});
server.listen(Number(process.env.PORT ?? 3000), '0.0.0.0', () =>
  console.log(`Archive X-Ray écoute sur le port ${process.env.PORT ?? 3000}`),
);
