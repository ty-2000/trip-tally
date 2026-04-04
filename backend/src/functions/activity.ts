import { APIGatewayProxyHandler } from 'aws-lambda';
import { getActivity } from '../services/activityService';
import { calculateBalances } from '../services/balanceService';
import { ok, badRequest, handleError, options } from '../utils/response';

// GET /trips/:tripId/activity
export const list: APIGatewayProxyHandler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return options();
  try {
    const tripId = event.pathParameters?.tripId;
    if (!tripId) return badRequest('tripId is required');

    const cursor = event.queryStringParameters?.cursor ?? undefined;
    const limit = parseInt(event.queryStringParameters?.limit ?? '50', 10);

    const result = await getActivity(tripId, cursor, Math.min(limit, 100));
    return ok(result);
  } catch (err) {
    return handleError(err);
  }
};

// GET /trips/:tripId/balances
export const balances: APIGatewayProxyHandler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return options();
  try {
    const tripId = event.pathParameters?.tripId;
    if (!tripId) return badRequest('tripId is required');

    const result = await calculateBalances(tripId);
    return ok(result);
  } catch (err) {
    return handleError(err);
  }
};
