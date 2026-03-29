/**
 * Bybit Demo Trading — Локальный CORS-прокси
 * ============================================
 * Запуск:  node proxy.js
 * Порт:    9001  (можно изменить ниже)
 *
 * Как работает:
 *   Браузер → http://localhost:9001/bybit/* → https://api-demo.bybit.com/*
 *
 * Подпись (HMAC) остаётся на стороне браузера — прокси только пересылает
 * заголовки и параметры без изменений. Секрет никогда не покидает браузер.
 */

const http  = require('http');
const https = require('https');
const url   = require('url');

const PORT        = 9001;
const TARGET_HOST = 'api-demo.bybit.com';

// ---- CORS headers (разрешаем любой origin для локальной разработки) ----
const CORS = {
  'Access-Control-Allow-Origin':  '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': [
    'Content-Type',
    'X-BAPI-API-KEY',
    'X-BAPI-TIMESTAMP',
    'X-BAPI-SIGN',
    'X-BAPI-RECV-WINDOW',
  ].join(', '),
};

const server = http.createServer((req, res) => {
  // Preflight
  if (req.method === 'OPTIONS') {
    res.writeHead(204, CORS);
    res.end();
    return;
  }

  // Health check
  if (req.url === '/health' || req.url === '/') {
    res.writeHead(200, { ...CORS, 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ status: 'ok', proxy: 'Bybit Demo', port: PORT }));
    return;
  }

  // Маршрут: /bybit/v5/... → https://api-demo.bybit.com/v5/...
  if (!req.url.startsWith('/bybit/')) {
    res.writeHead(404, { ...CORS, 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Use /bybit/<path> to proxy to api-demo.bybit.com' }));
    return;
  }

  const parsedUrl   = url.parse(req.url);
  const targetPath  = parsedUrl.pathname.replace('/bybit', '') + (parsedUrl.search || '');

  // Пересылаем только нужные заголовки (без host/origin/referer)
  const allowedHeaders = [
    'x-bapi-api-key',
    'x-bapi-timestamp',
    'x-bapi-sign',
    'x-bapi-recv-window',
    'content-type',
  ];
  const forwardHeaders = {};
  for (const [k, v] of Object.entries(req.headers)) {
    if (allowedHeaders.includes(k.toLowerCase())) forwardHeaders[k] = v;
  }
  forwardHeaders['host'] = TARGET_HOST;

  const options = {
    hostname: TARGET_HOST,
    port:     443,
    path:     targetPath,
    method:   req.method,
    headers:  forwardHeaders,
  };

  const proxyReq = https.request(options, (proxyRes) => {
    const responseHeaders = { ...CORS, 'Content-Type': 'application/json' };
    res.writeHead(proxyRes.statusCode, responseHeaders);
    proxyRes.pipe(res);
  });

  proxyReq.on('error', (err) => {
    console.error('[proxy] Upstream error:', err.message);
    res.writeHead(502, { ...CORS, 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Upstream error: ' + err.message }));
  });

  req.pipe(proxyReq);
});

server.listen(PORT, '127.0.0.1', () => {
  console.log('');
  console.log('  ╔══════════════════════════════════════════════╗');
  console.log('  ║   Bybit Demo CORS Proxy — запущен!           ║');
  console.log('  ╠══════════════════════════════════════════════╣');
  console.log(`  ║   Адрес:  http://localhost:${PORT}              ║`);
  console.log('  ║   Цель:   https://api-demo.bybit.com         ║');
  console.log('  ║                                              ║');
  console.log('  ║   Откройте index.html в браузере и           ║');
  console.log('  ║   подключите Bybit Demo аккаунт.             ║');
  console.log('  ║                                              ║');
  console.log('  ║   Для остановки нажмите Ctrl+C               ║');
  console.log('  ╚══════════════════════════════════════════════╝');
  console.log('');
});

server.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.error(`\n  ⚠️  Порт ${PORT} уже занят.`);
    console.error('  Либо прокси уже запущен, либо смените PORT в proxy.js\n');
  } else {
    console.error('Server error:', err);
  }
  process.exit(1);
});
