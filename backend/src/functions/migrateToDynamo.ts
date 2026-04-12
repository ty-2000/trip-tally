/**
 * One-shot Lambda: copies all data from Aurora (PostgreSQL) to DynamoDB.
 * Safe to re-run — DynamoDB PutItem is idempotent.
 *
 * Invoke:
 *   aws lambda invoke \
 *     --function-name trip-tally-migrate-to-dynamo \
 *     --region us-east-1 \
 *     --payload '{}' \
 *     /tmp/out.json \
 *   && cat /tmp/out.json
 */

import { BatchWriteCommand } from '@aws-sdk/lib-dynamodb';
import { ddb, TABLE_NAME } from '../repositories/dynamo/client';
import { keys } from '../repositories/dynamo/keys';
import { query } from '../db/client';

const BATCH_SIZE = 25;

interface TripRow {
  id: string; name: string; description: string | null;
  currency: string; created_at: unknown; updated_at: unknown;
}
interface MemberRow {
  id: string; trip_id: string; name: string; created_at: unknown;
}
interface ExpenseRow {
  id: string; trip_id: string; paid_by_member_id: string;
  title: string; amount: number; currency: string; split_type: string;
  receipt_s3_key: string | null; created_by_member_id: string | null;
  created_at: unknown; updated_at: unknown;
}
interface SplitRow {
  id: string; expense_id: string; member_id: string; trip_id: string;
  amount: number; percentage: string | null;
}
interface ActivityRow {
  id: string; trip_id: string; member_id: string | null;
  event_type: string; metadata: Record<string, unknown>; created_at: unknown;
}

function ts(value: unknown): string {
  if (value instanceof Date) return value.toISOString();
  return String(value);
}

async function batchWrite(items: Record<string, unknown>[]): Promise<void> {
  for (let i = 0; i < items.length; i += BATCH_SIZE) {
    const chunk = items.slice(i, i + BATCH_SIZE);
    await ddb.send(
      new BatchWriteCommand({
        RequestItems: {
          [TABLE_NAME]: chunk.map((Item) => ({ PutRequest: { Item } })),
        },
      })
    );
  }
}

export const handler = async () => {
  const counts: Record<string, number> = {};

  try {
    // 1. Trips
    const trips = await query<TripRow>('SELECT * FROM trips ORDER BY created_at');
    counts.trips = trips.length;
    await batchWrite(
      trips.map((t) => ({
        ...keys.tripMeta(t.id),
        type: 'TRIP',
        id: t.id,
        name: t.name,
        ...(t.description ? { description: t.description } : {}),
        currency: t.currency,
        created_at: ts(t.created_at),
        updated_at: ts(t.updated_at),
      }))
    );

    // 2. Members
    const members = await query<MemberRow>('SELECT * FROM members ORDER BY created_at');
    counts.members = members.length;
    await batchWrite(
      members.map((m) => ({
        ...keys.member(m.trip_id, m.id),
        type: 'MEMBER',
        id: m.id,
        trip_id: m.trip_id,
        name: m.name,
        name_lower: m.name.toLowerCase(),
        created_at: ts(m.created_at),
      }))
    );

    // 3. Expenses
    const expenses = await query<ExpenseRow>('SELECT * FROM expenses ORDER BY created_at');
    counts.expenses = expenses.length;
    await batchWrite(
      expenses.map((e) => ({
        ...keys.expense(e.trip_id, ts(e.created_at), e.id),
        type: 'EXPENSE',
        id: e.id,
        trip_id: e.trip_id,
        paid_by_member_id: e.paid_by_member_id,
        title: e.title,
        amount: e.amount,
        currency: e.currency,
        split_type: e.split_type,
        ...(e.receipt_s3_key ? { receipt_s3_key: e.receipt_s3_key } : {}),
        ...(e.created_by_member_id ? { created_by_member_id: e.created_by_member_id } : {}),
        created_at: ts(e.created_at),
        updated_at: ts(e.updated_at),
      }))
    );

    // 4. Splits
    const splits = await query<SplitRow>(
      `SELECT s.*, e.trip_id FROM expense_splits s JOIN expenses e ON e.id = s.expense_id`
    );
    counts.splits = splits.length;
    await batchWrite(
      splits.map((s) => ({
        ...keys.split(s.trip_id, s.expense_id, s.member_id),
        type: 'SPLIT',
        id: s.id,
        expense_id: s.expense_id,
        trip_id: s.trip_id,
        member_id: s.member_id,
        amount: s.amount,
        ...(s.percentage !== null ? { percentage: parseFloat(s.percentage) } : {}),
        created_at: new Date().toISOString(),
      }))
    );

    // 5. Activity log
    const activities = await query<ActivityRow>(
      'SELECT * FROM activity_log ORDER BY created_at'
    );
    counts.activities = activities.length;
    await batchWrite(
      activities.map((a) => ({
        ...keys.activity(a.trip_id, ts(a.created_at), a.id),
        type: 'ACTIVITY',
        id: a.id,
        trip_id: a.trip_id,
        ...(a.member_id ? { member_id: a.member_id } : {}),
        event_type: a.event_type,
        metadata: a.metadata,
        created_at: ts(a.created_at),
      }))
    );

    console.log('Migration complete:', counts);
    return { success: true, counts };
  } catch (err) {
    console.error('Migration failed:', err);
    return { success: false, error: (err as Error).message, counts };
  }
};
