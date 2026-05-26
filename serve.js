#!/usr/bin/env node
// Anton 2026-05-26: tiny static + twins-log server. Drop-in replacement
// for `python3 -m http.server 8888` — serves the same files AND
// auto-appends twin choices to twins-log.jsonl. Run with:
//   node serve.js
const http = require('http');
const fs   = require('fs');
const path = require('path');

const PORT     = 8888;
const ROOT     = __dirname;
const LOG_FILE = path.join(ROOT, 'twins-log.jsonl');

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js':   'application/javascript',
  '.json': 'application/json',
  '.svg':  'image/svg+xml',
  '.png':  'image/png',
  '.jpg':  'image/jpeg',
  '.css':  'text/css',
  '.ico':  'image/x-icon',
};

http.createServer((req, res) => {
  // CORS for safety (browser is same-origin so usually not needed but cheap).
  res.setHeader('Access-Control-Allow-Origin',  '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') { res.writeHead(204); return res.end(); }

  // POST /twins-log → append one JSON line to twins-log.jsonl
  if (req.method === 'POST' && req.url === '/twins-log') {
    let body = '';
    req.on('data', c => { body += c; if (body.length > 200_000) req.destroy(); });
    req.on('end', () => {
      try {
        const obj = JSON.parse(body);
        fs.appendFileSync(LOG_FILE, JSON.stringify(obj) + '\n');
        res.writeHead(200, { 'Content-Type': 'text/plain' });
        res.end('ok');
      } catch (e) {
        res.writeHead(400, { 'Content-Type': 'text/plain' });
        res.end('bad json: ' + e.message);
      }
    });
    return;
  }

  // GET /twins-log → return the whole log (so the in-page VIEW LOG can
  // show the file-side log, not just localStorage).
  if (req.method === 'GET' && req.url === '/twins-log') {
    fs.readFile(LOG_FILE, 'utf8', (err, data) => {
      if (err) { res.writeHead(200, { 'Content-Type': 'text/plain' }); return res.end(''); }
      res.writeHead(200, { 'Content-Type': 'application/x-ndjson' });
      res.end(data);
    });
    return;
  }

  // Static files.
  let url = decodeURIComponent(req.url.split('?')[0]);
  if (url === '/' || url === '') url = '/index.html';
  let filePath = path.join(ROOT, url);
  // Block path traversal outside ROOT
  if (!filePath.startsWith(ROOT)) { res.writeHead(403); return res.end('nope'); }
  fs.stat(filePath, (err, stat) => {
    if (err || !stat.isFile()) {
      res.writeHead(404, { 'Content-Type': 'text/plain' });
      return res.end('not found: ' + url);
    }
    const ext = path.extname(filePath).toLowerCase();
    res.writeHead(200, { 'Content-Type': MIME[ext] || 'application/octet-stream' });
    fs.createReadStream(filePath).pipe(res);
  });
}).listen(PORT, () => {
  console.log(`serving ${ROOT}`);
  console.log(`  → http://localhost:${PORT}/index.v3.html`);
  console.log(`  twin choices appended to: ${LOG_FILE}`);
});
