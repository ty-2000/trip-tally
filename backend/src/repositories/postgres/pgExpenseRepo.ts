import { query, queryOne, withTransaction } from '../../db/client';
import { pgLogActivity } from './pgActivityRepo';
import { generateViewUrl } from '../../utils/s3';
import type { Expense, CreateExpenseRequest, UpdateExpenseRequest } from '../../../../shared/types';
import type { IExpenseRepository, ComputedSplit, ExpenseForBalance } from '../types';

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
  return {
    id: row.id,
    trip_id: row.trip_id,
    paid_by_member_id: row.paid_by_member_id,
    title: row.title,
    amount: row.amount,
    currency: row.currency,
    split_type: row.split_type as Expense['split_type'],
    splits: splits.map((s) => ({
      id: s.id,
      expense_id: s.expense_id,
      member_id: s.member_id,
      amount: s.amount,
      percentage: s.percentage !== null ? parseFloat(s.percentage) : undefined,
    })),
    receipt_url: receiptUrl,
    created_by_member_id: row.created_by_member_id ?? undefined,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

export class PgExpenseRepository implements IExpenseRepository {
  async findById(tripId: string, expenseId: string): Promise<Expense | null> {
    const row = await queryOne<ExpenseRow>(
      `SELECT * FROM expenses WHERE id = $1 AND trip_id = $2`,
      [expenseId, tripId]
    );
    if (!row) return null;
    const splitRows = await query<SplitRow>(
      `SELECT * FROM expense_splits WHERE expense_id = $1`,
      [expenseId]
    );
    return rowToExpense(row, splitRows);
  }

  async findByTrip(tripId: string): Promise<Expense[]> {
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

  async create(
    tripId: string,
    data: CreateExpenseRequest,
    currency: string,
    splits: ComputedSplit[]
  ): Promise<Expense> {
    return withTransaction(async (client) => {
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
          currency,
          data.split_type,
          data.created_by_member_id ?? null,
        ]
      );
      const expenseRow = expResult.rows[0];

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

      await pgLogActivity(
        tripId,
        'EXPENSE_ADDED',
        { expense_id: expenseRow.id, title: expenseRow.title, amount: expenseRow.amount },
        data.created_by_member_id,
        client
      );

      return rowToExpense(expenseRow, splitRows);
    });
  }

  async update(
    tripId: string,
    expenseId: string,
    data: UpdateExpenseRequest,
    newSplits: ComputedSplit[] | null,
    actorMemberId?: string
  ): Promise<Expense | null> {
    return withTransaction(async (client) => {
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
      if (updResult.rowCount === 0) return null;
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

      await pgLogActivity(
        tripId,
        'EXPENSE_UPDATED',
        { expense_id: expenseId, title: updatedRow.title, amount: updatedRow.amount },
        actorMemberId,
        client
      );

      return rowToExpense(updatedRow, splitRows);
    });
  }

  async remove(tripId: string, expenseId: string, actorMemberId?: string): Promise<Expense | null> {
    return withTransaction(async (client) => {
      const splitResult = await client.query<SplitRow>(
        `SELECT * FROM expense_splits WHERE expense_id = $1`,
        [expenseId]
      );

      const result = await client.query<ExpenseRow>(
        `DELETE FROM expenses WHERE id = $1 AND trip_id = $2 RETURNING *`,
        [expenseId, tripId]
      );
      if (result.rowCount === 0) return null;
      const deleted = result.rows[0];

      await pgLogActivity(
        tripId,
        'EXPENSE_DELETED',
        { expense_id: expenseId, title: deleted.title, amount: deleted.amount },
        actorMemberId,
        client
      );

      return rowToExpense(deleted, splitResult.rows);
    });
  }

  async attachReceipt(tripId: string, expenseId: string, s3Key: string): Promise<void> {
    await query(
      `UPDATE expenses SET receipt_s3_key = $1 WHERE id = $2 AND trip_id = $3`,
      [s3Key, expenseId, tripId]
    );
  }

  async findForBalance(tripId: string): Promise<ExpenseForBalance[]> {
    return query<ExpenseForBalance>(
      `SELECT
         e.id                AS expense_id,
         e.paid_by_member_id,
         e.amount            AS paid_amount,
         json_agg(json_build_object('member_id', s.member_id, 'amount', s.amount)) AS splits
       FROM expenses e
       JOIN expense_splits s ON s.expense_id = e.id
       WHERE e.trip_id = $1
       GROUP BY e.id`,
      [tripId]
    );
  }
}
