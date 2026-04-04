import { APIGatewayProxyResult } from 'aws-lambda';
import { ZodError } from 'zod';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': process.env.FRONTEND_URL ?? '*',
  'Access-Control-Allow-Headers': 'Content-Type,Authorization',
  'Access-Control-Allow-Methods': 'GET,POST,PATCH,DELETE,OPTIONS',
  'Content-Type': 'application/json',
};

export function ok(body: unknown, statusCode = 200): APIGatewayProxyResult {
  return {
    statusCode,
    headers: CORS_HEADERS,
    body: JSON.stringify(body),
  };
}

export function created(body: unknown): APIGatewayProxyResult {
  return ok(body, 201);
}

export function noContent(): APIGatewayProxyResult {
  return { statusCode: 204, headers: CORS_HEADERS, body: '' };
}

export function badRequest(message: string, details?: unknown): APIGatewayProxyResult {
  return {
    statusCode: 400,
    headers: CORS_HEADERS,
    body: JSON.stringify({ error: message, details }),
  };
}

export function notFound(message = 'Not found'): APIGatewayProxyResult {
  return {
    statusCode: 404,
    headers: CORS_HEADERS,
    body: JSON.stringify({ error: message }),
  };
}

export function conflict(message: string): APIGatewayProxyResult {
  return {
    statusCode: 409,
    headers: CORS_HEADERS,
    body: JSON.stringify({ error: message }),
  };
}

export function internalError(err: unknown): APIGatewayProxyResult {
  console.error('Internal error:', err);
  return {
    statusCode: 500,
    headers: CORS_HEADERS,
    body: JSON.stringify({ error: 'Internal server error' }),
  };
}

export function handleError(err: unknown): APIGatewayProxyResult {
  if (err instanceof ZodError) {
    return badRequest('Validation error', err.issues);
  }
  if (err instanceof NotFoundError) {
    return notFound(err.message);
  }
  if (err instanceof ConflictError) {
    return conflict(err.message);
  }
  if (err instanceof BadRequestError) {
    return badRequest(err.message);
  }
  return internalError(err);
}

export function options(): APIGatewayProxyResult {
  return { statusCode: 200, headers: CORS_HEADERS, body: '' };
}

export class NotFoundError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'NotFoundError';
  }
}

export class ConflictError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ConflictError';
  }
}

export class BadRequestError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'BadRequestError';
  }
}
