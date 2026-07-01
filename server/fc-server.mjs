#!/usr/bin/env node
// FC custom runtime 入口：把 TanStack Start 导出的 fetch 包成 HTTP server
// 监听 PORT（FC 默认是 9000，但支持通过 PORT 环境变量覆盖）。
//
// FC custom.debian12 会把请求以 HTTP 形式发到 :PORT，因此这里就是
// 一个普通的 http.createServer().listen()。
import http from 'node:http';
import { Readable } from 'node:stream';
// 从 fc-server.mjs 的位置开始找 dist/：fc-deploy/ 与 仓库根 server/ 都是
// ./dist/server/server.js（同级目录下的 dist/）。
import server from './dist/server/server.js';

const port = Number(process.env.PORT ?? 9000);
const host = process.env.HOST ?? '0.0.0.0';

const srv = http.createServer(async (req, res) => {
  try {
    const chunks = [];
    for await (const chunk of req) chunks.push(chunk);
    const body = chunks.length ? Buffer.concat(chunks).toString('utf8') : undefined;

    const url = `http://${req.headers.host ?? 'localhost'}${req.url}`;
    const headers = new Headers();
    for (const [k, v] of Object.entries(req.headers)) {
      if (Array.isArray(v)) headers.set(k, v.join(', '));
      else if (v !== undefined) headers.set(k, String(v));
    }

    const init = {
      method: req.method,
      headers,
      body: ['GET', 'HEAD'].includes(req.method ?? 'GET') ? undefined : body,
    };

    const response = await server.fetch(new Request(url, init));
    res.statusCode = response.status;
    response.headers.forEach((v, k) => {
      // 跳过 hop-by-hop 头
      if (!['content-encoding', 'transfer-encoding'].includes(k.toLowerCase())) {
        res.setHeader(k, v);
      }
    });
    if (response.body) {
      const node = Readable.fromWeb(response.body);
      for await (const chunk of node) res.write(chunk);
    }
    res.end();
  } catch (err) {
    console.error('[fc-server] error', err);
    if (!res.headersSent) res.writeHead(500, { 'content-type': 'text/plain' });
    res.end('Internal Server Error');
  }
});

srv.listen(port, host, () => {
  console.log(`[docbase] listening on http://${host}:${port}`);
});

const shutdown = () => {
  console.log('[docbase] shutting down');
  srv.close(() => process.exit(0));
  setTimeout(() => process.exit(1), 10_000).unref();
};
process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);