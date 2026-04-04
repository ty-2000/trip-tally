/**
 * Local development server — wraps Lambda handlers in a minimal Express app.
 * NOT for production use.
 *
 * Usage:
 *   npx ts-node src/local-server.ts
 */
import 'dotenv/config';
import http from 'http';
import { URLSearchParams } from 'url';
import * as trips from './functions/trips';
import * as members from './functions/members';
import * as expenses from './functions/expenses';
import * as uploads from './functions/uploads';
import * as activity from './functions/activity';
import type { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';

const PORT = process.env.PORT ?? 3001;

/** Minimal shim: convert Node IncomingMessage → APIGatewayProxyEvent */
async function readBody(req: http.IncomingMessage): Promise<string> {
  return new Promise((resolve) => {
    let data = '';
    req.on('data', (chunk) => (data += chunk));
    req.on('end', () => resolve(data));
  });
}

function buildEvent(
  req: http.IncomingMessage,
  body: string,
  pathParameters: Record<string, string>,
  queryStringParameters: Record<string, string>
): APIGatewayProxyEvent {
  return {
    httpMethod: req.method ?? 'GET',
    path: req.url?.split('?')[0] ?? '/',
    pathParameters,
    queryStringParameters,
    body: body || null,
    headers: req.headers as Record<string, string>,
    multiValueHeaders: {},
    isBase64Encoded: false,
    resource: '',
    stageVariables: null,
    requestContext: {} as never,
    multiValueQueryStringParameters: null,
  };
}

type Handler = (event: APIGatewayProxyEvent) => Promise<APIGatewayProxyResult>;

interface Route {
  method: string;
  pattern: RegExp;
  paramNames: string[];
  handler: Handler;
}

const routes: Route[] = [];

function addRoute(method: string, path: string, handler: Handler) {
  const paramNames: string[] = [];
  const pattern = path.replace(/\{(\w+)\}/g, (_, name) => {
    paramNames.push(name);
    return '([^/]+)';
  });
  routes.push({ method, pattern: new RegExp(`^${pattern}$`), paramNames, handler });
}

// Register all routes
addRoute('POST',   '/trips',                                            trips.create);
addRoute('GET',    '/trips/{tripId}',                                   trips.get);
addRoute('PATCH',  '/trips/{tripId}',                                   trips.update);

addRoute('POST',   '/trips/{tripId}/members',                           members.create);
addRoute('GET',    '/trips/{tripId}/members',                           members.list);
addRoute('DELETE', '/trips/{tripId}/members/{memberId}',               members.remove);

addRoute('POST',   '/trips/{tripId}/expenses',                          expenses.create);
addRoute('GET',    '/trips/{tripId}/expenses',                          expenses.list);
addRoute('GET',    '/trips/{tripId}/expenses/{expenseId}',              expenses.get);
addRoute('PATCH',  '/trips/{tripId}/expenses/{expenseId}',              expenses.update);
addRoute('DELETE', '/trips/{tripId}/expenses/{expenseId}',             expenses.remove);

addRoute('POST',   '/trips/{tripId}/expenses/{expenseId}/upload-url',   uploads.getUploadUrl);
addRoute('PATCH',  '/trips/{tripId}/expenses/{expenseId}/receipt',      uploads.confirmReceipt);

addRoute('GET',    '/trips/{tripId}/activity',                          activity.list);
addRoute('GET',    '/trips/{tripId}/balances',                          activity.balances);

const server = http.createServer(async (req, res) => {
  // CORS preflight
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PATCH,DELETE,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') {
    res.writeHead(200);
    res.end();
    return;
  }

  const urlPath = req.url?.split('?')[0] ?? '/';
  const qs = Object.fromEntries(new URLSearchParams(req.url?.split('?')[1] ?? '').entries());
  const method = req.method ?? 'GET';

  for (const route of routes) {
    if (route.method !== method) continue;
    const match = urlPath.match(route.pattern);
    if (!match) continue;

    const pathParameters: Record<string, string> = {};
    route.paramNames.forEach((name, i) => {
      pathParameters[name] = match[i + 1];
    });

    const body = await readBody(req);
    const event = buildEvent(req, body, pathParameters, qs);

    try {
      const result = await route.handler(event);
      res.writeHead(result.statusCode, { 'Content-Type': 'application/json' });
      res.end(result.body);
    } catch (err) {
      console.error(err);
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Internal server error' }));
    }
    return;
  }

  res.writeHead(404, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ error: `No route: ${method} ${urlPath}` }));
});

server.listen(PORT, () => {
  console.log(`Local backend running at http://localhost:${PORT}`);
});
