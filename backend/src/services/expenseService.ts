import { query, queryOne, withTransaction } from '../db/client';
import { logActivity } from './activityService';
import { generateViewUrl } from '../utils/s3';
import {
  computeEqualSplits,
  percentagesToCents,
  validatePercentageSplits,
} from './debtSimplification';
import { NotFoundError, BadRequestError } from '../utils/response';
import type {
  Expense,
  ExpenseSplit,
  CreateExpenseRequest,
  UpdateExpenseRequest,
} from '../../../shared/types';

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

async function rowToExpense(row: ExpenseRow, splits: SplitRow[]): Promise<Expense> {
  let receiptUrl: string | undefined;
  if (row.receipt_s3_key) {
    receiptUrl = await generateViewUrl(row.receipt_s3_key);
  }

  const expenseSplits: ExpenseSplit[] = splits.map((s) => ({
    id: s.id,
    expense_id: s.expense_id,
    member_id: s.member_id,
    amount: s.amount,
    percentage: s.percentage !== null ? parseFloat(s.percentage) : undefined,
  }));

  return {
    id: row.id,
    trip_id: row.trip_id,
    paid_by_member_id: row.paid_by_member_id,
    title: row.title,
    amount: row.amount,
    currency: row.currency,
    split_type: row.split_type as Expense['split_type'],
    splits: expenseSplits,
    receipt_url: receiptUrl,
    created_by_member_id: row.created_by_member_id ?? undefined,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

function computeSplits(
  totalCents: number,
  splitType: Expense['split_type'],
  data: CreateExpenseRequest | UpdateExpenseRequest
): Array<{ member_id: string; amount: number; percentage?: number }> {
  if (splitType === 'EQUAL') {
    const participantIds = (data as CreateExpenseRequest).participant_ids;
    if (!participantIds || participantIds.length === 0) {
      throw new BadRequestError('participant_ids required for EQUAL split');
    }
    return computeEqualSplits(totalCents, participantIds);
  }

  if (splitType === 'EXACT') {
    const splits = data.splits;
    if (!splits || splits.length === 0) {
      throw new BadRequestError('splits required for EXACT split');
    }
    const sum = splits.reduce((acc, s) => acc + (s.amount ?? 0), 0);
    if (sum !== totalCents) {
      throw new BadRequestError(
        `EXACT splits sum (${sum}) must equal expense amount (${totalCents})`
      );
    }
    return splits.map((s) => ({ member_id: s.member_id, amount: s.amount! }));
  }

  if (splitType === 'PERCENTAGE') {
    const splits = data.splits;
    if (!splits || splits.length === 0) {
      throw new BadRequestError('splits required for PERCENTAGE split');
    }
    const percentages = splits.map((s) => s.percentage ?? 0);
    if (!validatePercentageSplits(percentages)) {
      throw new BadRequestError('Percentage splits must sum to 100');
    }
    return percentagesToCents(
      totalCents,
      splits.map((s) => ({ member_id: s.member_id, percentage: s.percentage! }))
    );
  }

  throw new BadRequestError(`Unknown split_type: ${splitType}`);
}

export async function createExpense(
  tripId: string,
  data: CreateExpenseRequest
): Promise<Expense> {
  const splitType = data.split_type;
  const splits = computeSplits(data.amount, splitType, data);

  // Verify the trip has the currency set; get it for the expense row
  const tripRow = await queryOne<{ currency: string }>(
    `SELECT currency FROM trips WHERE id = $1`,
    [tripId]
  );
  if (!tripRow) throw new NotFoundError(`Trip ${tripId} not found`);

  return await withTransaction(async (client) => {
    const expResult = await client.query<ExpenseRow>(
      `INSERT INTO expenses
         (trip_id, paid_by_member_id, title, amount, currency, split_type, created_by_member_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING *`,
      [
        tripId,
        data.paid_by_member_id,
        data.title.trim(),
        data.amount,
        tripRow.currency,
        splitType,
        data.created_by_member_id ?? null,
      ]
    );
    const expenseRow = expResult.rows[0];

    // Insert splits
    const splitRows: SplitRow[] = [];
    for (const split of splits) {
      const splitResult = await client.query<SplitRow>(
        `INSERT INTO expense_splits (expense_id, member_id, amount, percentage)
         VALUES ($1, $2, $3, $4)
         RETURNING *`,
        [expenseRow.id, split.member_id, split.amount, split.percentage ?? null]
      );
      splitRows.push(splitResult.rows[0]);
    }

    await logActivity(
      tripId,
      'EXPENSE_ADDED',
      { expense_id: expenseRow.id, title: expenseRow.title, amount: expenseRow.amount },
      data.created_by_member_id,
      client
    );

    return rowToExpense(expenseRow, splitRows);
  });
}

export async function getExpenses(tripId: string): Promise<Expense[]> {
  const expenseRows = await query<ExpenseRow>(
    `SELECT * FROM expenses WHERE trip_id = $1 ORDER BY created_at DESC`,
    [tripId]
  );

  if (expenseRows.length === 0) return [];

  const expenseIds = expenseRows.map((e) => e.id);
  const splitRows = await query<SplitRow>(
    `SELECT * FROM expense_splits WHERE expense_id = ANY($1)`,
    [expenseIds]
  );

  const splitsByExpense = new Map<string, SplitRow[]>();
  for (const s of splitRows) {
    const list = splitsByExpense.get(s.expense_id) ?? [];
    list.push(s);
    splitsByExpense.set(s.expense_id, list);
  }

  return Promise.all(
    expenseRows.map((row) => rowToExpense(row, splitsByExpense.get(row.id) ?? []))
  );
}

export async function getExpense(tripId: string, expenseId: string): Promise<Expense> {
  const expRow = await queryOne<ExpenseRow>(
    `SELECT * FROM expenses WHERE id = $1 AND trip_id = $2`,
    [expenseId, tripId]
  );
  if (!expRow) throw new NotFoundError(`Expense ${expenseId} not found`);

  const splitRows = await query<SplitRow>(
    `SELECT * FROM expense_splits WHERE expense_id = $1`,
    [expenseId]
  );
  return rowToExpense(expRow, splitRows);
}

export async function updateExpense(
  tripId: string,
  expenseId: string,
  data: UpdateExpenseRequest,
  actorMemberId?: string
): Promise<Expense> {
  const existing = await queryOne<ExpenseRow>(
    `SELECT * FROM expenses WHERE id = $1 AND trip_id = $2`,
    [expenseId, tripId]
  );
  if (!existing) throw new NotFoundError(`Expense ${expenseId} not found`);

  // Optimistic concurrency: reject if client's updated_at doesn't match
  if (data.updated_at && data.updated_at !== existing.updated_at) {
    throw new BadRequestError(
      'Expense was modified by someone else. Please refresh and try again.'
    );
  }

  const newAmount = data.amount ?? existing.amount;
  const newSplitType = (data.split_type ?? existing.split_type) as Expense['split_type'];

  let newSplits: Array<{ member_id: string; amount: number; percentage?: number }> | null = null;
  if (data.split_type || data.splits || data.participant_ids) {
    // Re-compute splits if any split-related fields changed
    const mergedData: CreateExpenseRequest = {
      paid_by_member_id: data.paid_by_member_id ?? existing.paid_by_member_id,
      title: data.title ?? existing.title,
      amount: newAmount,
      split_type: newSplitType,
      participant_ids: data.participant_ids,
      splits: data.splits,
    };
    newSplits = computeSplits(newAmount, newSplitType, mergedData);
  }

  return await withTransaction(async (client) => {
    const updResult = await client.query<ExpenseRow>(
      `UPDATE expenses
       SET paid_by_member_id = COALESCE($3, paid_by_member_id),
           title             = COALESCE($4, title),
           amount            = COALESCE($5, amount),
           split_type        = COALESCE($6, split_type)
       WHERE id = $1 AND trip_id = $2
       RETURNING *`,
      [
        expenseId,
        tripId,
        data.paid_by_member_id ?? null,
        data.title?.trim() ?? null,
        data.amount ?? null,
        data.split_type ?? null,
      ]
    );
    const updatedRow = updResult.rows[0];

    let splitRows: SplitRow[];
    if (newSplits) {
      await client.query(`DELETE FROM expense_splits WHERE expense_id = $1`, [expenseId]);
      splitRows = [];
      for (const split of newSplits) {
        const splitResult = await client.query<SplitRow>(
          `INSERT INTO expense_splits (expense_id, member_id, amount, percentage)
           VALUES ($1, $2, $3, $4)
           RETURNING *`,
          [expenseId, split.member_id, split.amount, split.percentage ?? null]
        );
        splitRows.push(splitResult.rows[0]);
      }
    } else {
      const splitResult = await client.query<SplitRow>(
        `SELECT * FROM expense_splits WHERE expense_id = $1`,
        [expenseId]
      );
      splitRows = splitResult.rows;
    }

    await logActivity(
      tripId,
      'EXPENSE_UPDATED',
      { expense_id: expenseId, title: updatedRow.title, amount: updatedRow.amount },
      actorMemberId,
      client
    );

    return rowToExpense(updatedRow, splitRows);
  });
}

export async function deleteExpense(
  tripId: string,
  expenseId: string,
  actorMemberId?: string
): Promise<void> {
  await withTransaction(async (client) => {
    const result = await client.query<ExpenseRow>(
      `DELETE FROM expenses WHERE id = $1 AND trip_id = $2 RETURNING *`,
      [expenseId, tripId]
    );
    if (result.rowCount === 0) {
      throw new NotFoundError(`Expense ${expenseId} not found`);
    }
    const deleted = result.rows[0];

    await logActivity(
      tripId,
      'EXPENSE_DELETED',
      { expense_id: expenseId, title: deleted.title, amount: deleted.amount },
      actorMemberId,
      client
    );
  });
}

export async function attachReceipt(
  tripId: string,
  expenseId: string,
  s3Key: string
): Promise<void> {
  const result = await query(
    `UPDATE expenses SET receipt_s3_key = $1 WHERE id = $2 AND trip_id = $3`,
    [s3Key, expenseId, tripId]
  );
  if (!result) throw new NotFoundError(`Expense ${expenseId} not found`);
}
