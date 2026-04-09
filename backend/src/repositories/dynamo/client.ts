import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb';

function createClient(): DynamoDBDocumentClient {
  const isLocal = process.env.DYNAMODB_ENDPOINT !== undefined;

  const raw = new DynamoDBClient(
    isLocal
      ? {
          endpoint: process.env.DYNAMODB_ENDPOINT,
          region: 'us-east-1',
          credentials: { accessKeyId: 'local', secretAccessKey: 'local' },
        }
      : { region: process.env.AWS_REGION ?? 'us-east-1' }
  );

  return DynamoDBDocumentClient.from(raw, {
    marshallOptions: { removeUndefinedValues: true },
  });
}

export const ddb = createClient();

export const TABLE_NAME = process.env.DYNAMODB_TABLE ?? 'trip-tally';
