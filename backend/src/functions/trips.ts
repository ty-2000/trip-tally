import { APIGatewayProxyHandler } from 'aws-lambda';
import { z } from 'zod';
import { createTrip, getTrip, updateTrip, getTripSummary } from '../services/tripService';
import { ok, created, badRequest, handleError, options } from '../utils/response';

const CreateTripSchema = z.object({
  name: z.string().min(1).max(255),
  description: z.string().max(1000).optional(),
  currency: z.string().length(3).toUpperCase(),
});

const UpdateTripSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  description: z.string().max(1000).optional(),
});

function parseBody(body: string | null) {
  if (!body) throw new Error('Request body is required');
  return JSON.parse(body);
}

// POST /trips
export const create: APIGatewayProxyHandler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return options();
  try {
    const data = CreateTripSchema.parse(parseBody(event.body));
    const trip = await createTrip(data);
    return created({ trip });
  } catch (err) {
    return handleError(err);
  }
};

// GET /trips/:tripId
export const get: APIGatewayProxyHandler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return options();
  try {
    const tripId = event.pathParameters?.tripId;
    if (!tripId) return badRequest('tripId is required');
    const summary = await getTripSummary(tripId);
    return ok(summary);
  } catch (err) {
    return handleError(err);
  }
};

// PATCH /trips/:tripId
export const update: APIGatewayProxyHandler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return options();
  try {
    const tripId = event.pathParameters?.tripId;
    if (!tripId) return badRequest('tripId is required');
    const data = UpdateTripSchema.parse(parseBody(event.body));
    const trip = await updateTrip(tripId, data);
    return ok({ trip });
  } catch (err) {
    return handleError(err);
  }
};
