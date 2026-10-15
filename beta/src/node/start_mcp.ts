import { randomUUID } from 'node:crypto';
import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { isInitializeRequest } from '@modelcontextprotocol/sdk/types.js';
import { createM3eMcpServer, validateM3eApiUrl, type M3eMcpOptions } from './mcp_server';

function reject(res: ServerResponse, status: number, message: string): void {
  res.writeHead(status, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ jsonrpc: '2.0', error: { code: status === 413 ? -32600 : -32000, message }, id: null }));
}

async function readBody(req: IncomingMessage): Promise<unknown> {
  const parts: Buffer[] = [];
  let size = 0;
  for await (const chunk of req) {
    const part = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    size += part.length;
    if (size > 2_000_000) throw new RangeError('Request exceeds the MCP input limit.');
    parts.push(part);
  }
  return JSON.parse(Buffer.concat(parts).toString('utf8'));
}

/** SDK Streamable HTTP, bound exclusively to loopback. Each SDK session owns its own adapter. */
export async function startM3eMcpHttp(options: M3eMcpOptions & { port?: number } = {}): Promise<{ url: string; close: () => Promise<void> }> {
  validateM3eApiUrl(options.apiUrl ?? process.env.M3E_API_URL ?? 'http://127.0.0.1:4173');
  const sessions = new Map<string, { transport: StreamableHTTPServerTransport; app: ReturnType<typeof createM3eMcpServer> }>();
  let actualPort = options.port ?? 4174;
  const http = createServer(async (req, res) => {
    const allowedHosts = [`127.0.0.1:${actualPort}`, `localhost:${actualPort}`];
    if (!req.headers.host || !allowedHosts.includes(req.headers.host)) { reject(res, 403, 'Invalid local MCP host.'); return; }
    if (req.headers.origin && !allowedHosts.some(host => req.headers.origin === `http://${host}`)) { reject(res, 403, 'Invalid local MCP origin.'); return; }
    if (req.url !== '/mcp') { reject(res, 404, 'MCP endpoint is /mcp.'); return; }
    if (!['POST', 'GET', 'DELETE'].includes(req.method || '')) { res.setHeader('Allow', 'POST, GET, DELETE'); reject(res, 405, 'Unsupported method.'); return; }
    let body: unknown;
    try {
      if (req.method === 'POST') body = await readBody(req);
      const sessionId = req.headers['mcp-session-id'];
      if (typeof sessionId === 'string') {
        const session = sessions.get(sessionId);
        if (!session) { reject(res, 404, 'MCP session has ended; initialize again.'); return; }
        await session.transport.handleRequest(req, res, body);
        return;
      }
      if (req.method !== 'POST' || !isInitializeRequest(body)) { reject(res, 400, 'Initialize an MCP session first.'); return; }
      const app = createM3eMcpServer(options);
      const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: randomUUID, onsessioninitialized: id => { sessions.set(id, { transport, app }); } });
      await app.server.connect(transport);
      const close = transport.onclose;
      transport.onclose = () => { if (transport.sessionId) sessions.delete(transport.sessionId); close?.(); void app.close(); };
      await transport.handleRequest(req, res, body);
      if (!transport.sessionId) await app.close();
    } catch (error) {
      if (!res.headersSent) reject(res, error instanceof RangeError ? 413 : 400, error instanceof RangeError ? error.message : 'Invalid MCP request.');
      else res.end();
    }
  });
  await new Promise<void>((resolve, rejectListen) => {
    http.once('error', rejectListen);
    http.listen(actualPort, '127.0.0.1', () => { http.off('error', rejectListen); resolve(); });
  });
  const address = http.address();
  if (!address || typeof address === 'string') throw new Error('Could not bind local MCP transport.');
  actualPort = address.port;
  return {
    url: `http://127.0.0.1:${actualPort}/mcp`,
    close: async () => {
      await Promise.allSettled([...sessions.values()].map(session => session.app.close()));
      sessions.clear();
      http.closeAllConnections();
      await new Promise<void>((resolve, rejectClose) => http.close(error => error ? rejectClose(error) : resolve()));
    },
  };
}

export async function main(args = process.argv.slice(2)): Promise<void> {
  if (args.includes('--help')) {
    process.stderr.write('M3E MCP: node start_mcp.js [--http --port 4174]\nM3E_API_URL defaults to http://127.0.0.1:4173. Stdio is the default; stdout carries MCP only. HTTP binds to 127.0.0.1.\n');
    return;
  }
  const http = args.includes('--http');
  const portIndex = args.indexOf('--port');
  const port = portIndex >= 0 ? Number(args[portIndex + 1]) : 4174;
  if (args.some((arg, index) => arg !== '--http' && arg !== '--port' && !(portIndex >= 0 && index === portIndex + 1))
      || !Number.isInteger(port) || port < 1 || port > 65535 || (!http && portIndex >= 0)) throw new Error('Usage: start_mcp.js [--http --port 4174]');
  const app = http ? await startM3eMcpHttp({ port }) : createM3eMcpServer();
  if ('server' in app) await app.server.connect(new StdioServerTransport());
  else process.stderr.write(`M3E MCP listening on ${app.url}\n`);
  let stopping = false;
  const shutdown = async () => { if (stopping) return; stopping = true; await app.close(); process.exitCode = 0; };
  process.once('SIGINT', () => { void shutdown(); });
  process.once('SIGTERM', () => { void shutdown(); });
}

if (require.main === module) main().catch(error => { process.stderr.write(`${error instanceof Error ? error.message : 'M3E MCP failed to start.'}\n`); process.exitCode = 1; });
