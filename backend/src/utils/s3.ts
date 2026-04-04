import { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { v4 as uuidv4 } from 'uuid';

const s3 = new S3Client({ region: process.env.AWS_REGION ?? 'us-east-1' });
const BUCKET = process.env.RECEIPTS_BUCKET ?? '';

const UPLOAD_EXPIRY_SECONDS = 300; // 5 minutes to complete upload
const VIEW_EXPIRY_SECONDS = 3600;  // 1 hour to view receipt

function receiptKey(tripId: string, expenseId: string, ext: string): string {
  return `receipts/${tripId}/${expenseId}/${uuidv4()}.${ext}`;
}

function extFromContentType(contentType: string): string {
  const map: Record<string, string> = {
    'image/jpeg': 'jpg',
    'image/jpg': 'jpg',
    'image/png': 'png',
    'image/gif': 'gif',
    'image/webp': 'webp',
    'application/pdf': 'pdf',
  };
  return map[contentType] ?? 'bin';
}

export async function generateUploadUrl(
  tripId: string,
  expenseId: string,
  contentType: string
): Promise<{ uploadUrl: string; s3Key: string; receiptUrl: string }> {
  const ext = extFromContentType(contentType);
  const s3Key = receiptKey(tripId, expenseId, ext);

  const command = new PutObjectCommand({
    Bucket: BUCKET,
    Key: s3Key,
    ContentType: contentType,
  });

  const uploadUrl = await getSignedUrl(s3, command, {
    expiresIn: UPLOAD_EXPIRY_SECONDS,
  });

  // The receipt URL is a separate presigned GET, generated fresh on reads.
  // We return a placeholder; the actual view URL is generated when fetching expenses.
  const receiptUrl = `s3://${BUCKET}/${s3Key}`;

  return { uploadUrl, s3Key, receiptUrl };
}

export async function generateViewUrl(s3Key: string): Promise<string> {
  const command = new GetObjectCommand({ Bucket: BUCKET, Key: s3Key });
  return getSignedUrl(s3, command, { expiresIn: VIEW_EXPIRY_SECONDS });
}

export async function deleteReceipt(s3Key: string): Promise<void> {
  await s3.send(new DeleteObjectCommand({ Bucket: BUCKET, Key: s3Key }));
}
