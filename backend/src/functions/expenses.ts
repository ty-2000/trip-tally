import { APIGatewayProxyHandler } from 'aws-lambda';
import { z } from 'zod';
import {
  createExpense,
  getExpenses,
  getExpense,
  updateExpense,
  deleteExpense,
} from '../services/expenseService';
import { ok, created, noContent, badRequest, handleError, options } from '../utils/response';

const SplitItemSchema = z.object({
  member_id: z.string().uuid(),
  amount: z.number().int().positive().optional(),
  percentage: z.number().positive().max(100).optional(),
});

const CreateExpenseSchema = z.object({
  paid_by_member_id: z.string().uuid(),
  title: z.string().min(1).max(255),
  amount: z.number().int().positive(), // cents
  split_type: z.enum(['EQUAL', 'EXACT', 'PERCENTAGE']),
  participant_ids: z.array(z.string().uuid()).optional(),
  splits: z.array(SplitItemSchema).optional(),
  created_by_member_id: z.string().uuid().optional(),
});

const UpdateExpenseSchema = z.object({
  paid_by_member_id: z.string().uuid().optional(),
  title: z.string().min(1).max(255).optional(),
  amount: z.number().int().positive().optional(),
  split_type: z.enum(['EQUAL', 'EXACT', 'PERCENTAGE']).optional(),
  participant_ids: z.array(z.string().uuid()).optional(),
  splits: z.array(SplitItemSchema).optional(),
  updated_at: z.string().optional(),
});

// POST /trips/:tripId/expenses
export const create: APIGatewayProxyHandler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return options();
  try {
    const tripId = event.pathParameters?.tripId;
    if (!tripId) return badRequest('tripId is required');
    const data = CreateExpenseSchema.parse(JSON.parse(event.body ?? '{}'));
    const expense = await createExpense(tripId, data);
    return created({ expense });
  } catch (err) {
    return handleError(err);
  }
};

// GET /trips/:tripId/expenses
export const list: APIGatewayProxyHandler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return options();
  try {
    const tripId = event.pathParameters?.tripId;
    if (!tripId) return badRequest('tripId is required');
    const expenses = await getExpenses(tripId);
    return ok({ expenses });
  } catch (err) {
    return handleError(err);
  }
};

// GET /trips/:tripId/expenses/:expenseId
export const get: APIGatewayProxyHandler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return options();
  try {
    const { tripId, expenseId } = event.pathParameters ?? {};
    if (!tripId || !expenseId) return badRequest('tripId and expenseId are required');
    const expense = await getExpense(tripId, expenseId);
    return ok({ expense });
  } catch (err) {
    return handleError(err);
  }
};

// PATCH /trips/:tripId/expenses/:expenseId
export const update: APIGatewayProxyHandler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return options();
  try {
    const { tripId, expenseId } = event.pathParameters ?? {};
    if (!tripId || !expenseId) return badRequest('tripId and expenseId are required');
    const body = JSON.parse(event.body ?? '{}');
    const data = UpdateExpenseSchema.parse(body);
    const actorMemberId = body.actor_member_id as string | undefined;
    const expense = await updateExpense(tripId, expenseId, data, actorMemberId);
    return ok({ expense });
  } catch (err) {
    return handleError(err);
  }
};

// DELETE /trips/:tripId/expenses/:expenseId
export const remove: APIGatewayProxyHandler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return options();
  try {
    const { tripId, expenseId } = event.pathParameters ?? {};
    if (!tripId || !expenseId) return badRequest('tripId and expenseId are required');
    const actorMemberId = event.queryStringParameters?.actor_member_id;
    await deleteExpense(tripId, expenseId, actorMemberId);
    return noContent();
  } catch (err) {
    return handleError(err);
  }
};
