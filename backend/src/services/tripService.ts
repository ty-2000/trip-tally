import { query, queryOne, withTransaction } from '../db/client';
import { logActivity } from './activityService';
import { calculateBalances } from './balanceService';
import { NotFoundError } from '../utils/response';
import type {
  Trip,
  Member,
  Expense,
  ExpenseSplit,
  CreateTripRequest,
  UpdateTripRequest,
  TripSummaryResponse,
} from '../../../shared/types';
import { generateViewUrl } from '../utils/s3';

interface TripRow {
  id: string;
  name: string;
  description: string | null;
  currency: string;
  created_at: string;
  updated_at: string;
}

interface MemberRow {
  id: string;
  trip_id: string;
  name: string;
  created_at: string;
}

interface ExpenseRow {
  id: string;
  trip_id: string;
  paid_by_member_id: string;
  title: string;
  amount: number;
  currency: string;
  split_type: string;
  receipt_s3_key: string | null;
  created_by_member_id: string | null;
  created_at: string;
  updated_at: string;
}

interface SplitRow {
  id: string;
  expense_id: string;
  member_id: string;
  amount: number;
  percentage: string | null;
}

function rowToTrip(row: TripRow): Trip {
  return {
    id: row.id,
    name: row.name,
    description: row.description ?? undefined,
    currency: row.currency,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

export async function createTrip(data: CreateTripRequest): Promise<Trip> {
  return await withTransaction(async (client) => {
    const rows = await client.query<TripRow>(
      `INSERT INTO trips (name, description, currency)
       VALUES ($1, $2, $3)
       RETURNING *`,
      [data.name.trim(), data.description?.trim() ?? null, data.currency.toUpperCase()]
    );
    const trip = rowToTrip(rows.rows[0]);
    await logActivity(trip.id, 'TRIP_CREATED', { name: trip.name }, undefined, client);
    return trip;
  });
}

export async function getTrip(tripId: string): Promise<Trip> {
  const row = await queryOne<TripRow>(
    `SELECT * FROM trips WHERE id = $1`,
    [tripId]
  );
  if (!row) throw new NotFoundError(`Trip ${tripId} not found`);
  return rowToTrip(row);
}

export async function updateTrip(tripId: string, data: UpdateTripRequest): Promise<Trip> {
  const row = await queryOne<TripRow>(
    `UPDATE trips
     SET name        = COALESCE($2, name),
         description = COALESCE($3, description)
     WHERE id = $1
     RETURNING *`,
    [tripId, data.name?.trim() ?? null, data.description?.trim() ?? null]
  );
  if (!row) throw new NotFoundError(`Trip ${tripId} not found`);
  return rowToTrip(row);
}

export async function getTripSummary(tripId: string): Promise<TripSummaryResponse> {
  const trip = await getTrip(tripId);

  const [memberRows, expenseRows, splitRows] = await Promise.all([
    query<MemberRow>(`SELECT * FROM members WHERE trip_id = $1 ORDER BY created_at`, [tripId]),
    query<ExpenseRow>(`SELECT * FROM expenses WHERE trip_id = $1 ORDER BY created_at DESC`, [tripId]),
    query<SplitRow>(
      `SELECT s.*
       FROM expense_splits s
       JOIN expenses e ON e.id = s.expense_id
       WHERE e.trip_id = $1`,
      [tripId]
    ),
  ]);

  const splitsByExpense = new Map<string, ExpenseSplit[]>();
  for (const row of splitRows) {
    const splits = splitsByExpense.get(row.expense_id) ?? [];
    splits.push({
      id: row.id,
      expense_id: row.expense_id,
      member_id: row.member_id,
      amount: row.amount,
      percentage: row.percentage !== null ? parseFloat(row.percentage) : undefined,
    });
    splitsByExpense.set(row.expense_id, splits);
  }

  const expenses: Expense[] = await Promise.all(
    expenseRows.map(async (row) => {
      let receiptUrl: string | undefined;
      if (row.receipt_s3_key) {
        receiptUrl = await generateViewUrl(row.receipt_s3_key);
      }
      return {
        id: row.id,
        trip_id: row.trip_id,
        paid_by_member_id: row.paid_by_member_id,
        title: row.title,
        amount: row.amount,
        currency: row.currency,
        split_type: row.split_type as Expense['split_type'],
        splits: splitsByExpense.get(row.id) ?? [],
        receipt_url: receiptUrl,
        created_by_member_id: row.created_by_member_id ?? undefined,
        created_at: row.created_at,
        updated_at: row.updated_at,
      };
    })
  );

  const members: Member[] = memberRows.map((row) => ({
    id: row.id,
    trip_id: row.trip_id,
    name: row.name,
    created_at: row.created_at,
  }));

  const { balances, settlements } = await calculateBalances(tripId);

  return { trip, members, expenses, balances, settlements };
}
