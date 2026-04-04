import { APIGatewayProxyHandler } from 'aws-lambda';
import { z } from 'zod';
import { generateUploadUrl } from '../utils/s3';
import { attachReceipt } from '../services/expenseService';
import { ok, badRequest, handleError, options } from '../utils/response';

const UploadUrlSchema = z.object({
  content_type: z.string().refine(
    (v) => ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif', 'application/pdf'].includes(v),
    { message: 'Unsupported content type' }
  ),
});

const ConfirmReceiptSchema = z.object({
  s3_key: z.string().min(1),
});

// POST /trips/:tripId/expenses/:expenseId/upload-url
export const getUploadUrl: APIGatewayProxyHandler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return options();
  try {
    const { tripId, expenseId } = event.pathParameters ?? {};
    if (!tripId || !expenseId) return badRequest('tripId and expenseId are required');

    const { content_type } = UploadUrlSchema.parse(JSON.parse(event.body ?? '{}'));
    const result = await generateUploadUrl(tripId, expenseId, content_type);

    return ok({
      upload_url: result.uploadUrl,
      s3_key: result.s3Key,
      receipt_url: result.receiptUrl,
    });
  } catch (err) {
    return handleError(err);
  }
};

// PATCH /trips/:tripId/expenses/:expenseId/receipt
export const confirmReceipt: APIGatewayProxyHandler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return options();
  try {
    const { tripId, expenseId } = event.pathParameters ?? {};
    if (!tripId || !expenseId) return badRequest('tripId and expenseId are required');

    const { s3_key } = ConfirmReceiptSchema.parse(JSON.parse(event.body ?? '{}'));
    await attachReceipt(tripId, expenseId, s3_key);

    return ok({ message: 'Receipt attached successfully' });
  } catch (err) {
    return handleError(err);
  }
};
