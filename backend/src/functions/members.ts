import { APIGatewayProxyHandler } from 'aws-lambda';
import { z } from 'zod';
import { addMember, getMembers, removeMember } from '../services/memberService';
import { ok, created, noContent, badRequest, handleError, options } from '../utils/response';

const CreateMemberSchema = z.object({
  name: z.string().min(1).max(100),
});

// POST /trips/:tripId/members
export const create: APIGatewayProxyHandler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return options();
  try {
    const tripId = event.pathParameters?.tripId;
    if (!tripId) return badRequest('tripId is required');
    const { name } = CreateMemberSchema.parse(JSON.parse(event.body ?? '{}'));
    const member = await addMember(tripId, name);
    return created({ member });
  } catch (err) {
    return handleError(err);
  }
};

// GET /trips/:tripId/members
export const list: APIGatewayProxyHandler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return options();
  try {
    const tripId = event.pathParameters?.tripId;
    if (!tripId) return badRequest('tripId is required');
    const members = await getMembers(tripId);
    return ok({ members });
  } catch (err) {
    return handleError(err);
  }
};

// DELETE /trips/:tripId/members/:memberId
export const remove: APIGatewayProxyHandler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return options();
  try {
    const { tripId, memberId } = event.pathParameters ?? {};
    if (!tripId || !memberId) return badRequest('tripId and memberId are required');
    await removeMember(tripId, memberId);
    return noContent();
  } catch (err) {
    return handleError(err);
  }
};
