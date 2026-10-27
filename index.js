const jsonServer = require('json-server');
const path = require('path');

const server = jsonServer.create();
const router = jsonServer.router(path.join(__dirname, '../db.json'));
const middlewares = jsonServer.defaults();

// ── CORS – allow the React dev server (any origin) ──────────────────────────
server.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET,POST,PUT,PATCH,DELETE,OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.sendStatus(200);
  next();
});

// ── Body-size limit: 10 MB to handle base64 avatar images ───────────────────
server.use(require('express').json({ limit: '10mb' }));
server.use(require('express').urlencoded({ limit: '10mb', extended: true }));

// ── json-server defaults (logger, static, no-cache) ─────────────────────────
server.use(middlewares);

// ── Routes ───────────────────────────────────────────────────────────────────
server.use(router);

// ── Start ────────────────────────────────────────────────────────────────────
server.listen(3001, () => {
  console.log('JSON Server running on http://localhost:3001');
});
