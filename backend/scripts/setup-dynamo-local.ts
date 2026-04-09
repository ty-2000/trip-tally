/**
 * Creates the DynamoDB table for local development.
 * Run once after starting docker-compose:
 *
 *   docker-compose up -d dynamodb-local
 *   npx ts-node --transpile-only scripts/setup-dynamo-local.ts
 */
import { DynamoDBClient, CreateTableCommand, ListTablesCommand } from '@aws-sdk/client-dynamodb';

const TABLE_NAME = process.env.DYNAMODB_TABLE ?? 'trip-tally';
const ENDPOINT = process.env.DYNAMODB_ENDPOINT ?? 'http://localhost:8000';

const client = new DynamoDBClient({
  endpoint: ENDPOINT,
  region: 'us-east-1',
  credentials: { accessKeyId: 'local', secretAccessKey: 'local' },
});

async function main() {
  // Check if table already exists
  const { TableNames } = await client.send(new ListTablesCommand({}));
  if (TableNames?.includes(TABLE_NAME)) {
    console.log(`Table "${TABLE_NAME}" already exists.`);
    return;
  }

  await client.send(
    new CreateTableCommand({
      TableName: TABLE_NAME,
      BillingMode: 'PAY_PER_REQUEST',
      AttributeDefinitions: [
        { AttributeName: 'PK', AttributeType: 'S' },
        { AttributeName: 'SK', AttributeType: 'S' },
      ],
      KeySchema: [
        { AttributeName: 'PK', KeyType: 'HASH' },
        { AttributeName: 'SK', KeyType: 'RANGE' },
      ],
    })
  );

  console.log(`Table "${TABLE_NAME}" created.`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
