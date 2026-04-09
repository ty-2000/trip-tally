import {
  GetCommand,
  PutCommand,
  DeleteCommand,
  QueryCommand,
  UpdateCommand,
  TransactWriteCommand,
} from '@aws-sdk/lib-dynamodb';
import { v4 as uuidv4 } from 'uuid';
import { ddb, TABLE_NAME } from './client';
import { keys } from './keys';
import { dyLogActivity } from './dyActivityRepo';
import { generateViewUrl } from '../../utils/s3';
import type { Expense, CreateExpenseRequest, UpdateExpenseRequest } from '../../../../shared/types';
import type { IExpenseRepository, ComputedSplit, ExpenseForBalance } from '../types';

interface ExpenseItem {
  PK: string;
  SK: string;
  type: 'EXPENSE';
  id: string;
  trip_id: string;
  paid_by_member_id: string;
  title: string;
  amount: number;
  currency: string;
  split_type: string;
  receipt_s3_key?: string;
  created_by_member_id?: string;
  created_at: string;
  updated_at: string;
}

interface SplitItem {
  PK: string;
  SK: string;
  type: 'SPLIT';
  id: string;
  expense_id: string;
  trip_id: string;
  member_id: string;
  amount: number;
  percentage?: number;
  created_at: string;
}

async function itemToExpense(item: ExpenseItem, splits: SplitItem[]): Promise<Expense> {
  let receiptUrl: string | undefined;
  if (item.receipt_s3_key) {
    receiptUrl = await generateViewUrl(item.receipt_s3_key);
  }
  return {
    id: item.id,
    trip_id: item.trip_id,
    paid_by_member_id: item.paid_by_member_id,
    title: item.title,
    amount: item.amount,
    currency: item.currency,
    split_type: item.split_type as Expense['split_type'],
    splits: splits.map((s) => ({
      id: s.id,
      expense_id: s.expense_id,
      member_id: s.member_id,
      amount: s.amount,
      percentage: s.percentage,
    })),
    receipt_url: receiptUrl,
    created_by_member_id: item.created_by_member_id,
    created_at: item.created_at,
    updated_at: item.updated_at,
  };
}

async function getSplitsForExpense(tripId: string, expenseId: string): Promise<SplitItem[]> {
  const { PK, SKPrefix } = keys.prefixes.splitsForExpense(tripId, expenseId);
  const result = await ddb.send(
    new QueryCommand({
      TableName: TABLE_NAME,
      KeyConditionExpression: 'PK = :pk AND begins_with(SK, :prefix)',
      ExpressionAttributeValues: { ':pk': PK, ':prefix': SKPrefix },
    })
  );
  return (result.Items ?? []) as SplitItem[];
}

export class DyExpenseRepository implements IExpenseRepository {
  async findById(tripId: string, expenseId: string): Promise<Expense | null> {
    // Need to find the expense by id — scan expenses for this trip
    const { PK, SKPrefix } = keys.prefixes.expenses(tripId);
    const result = await ddb.send(
      new QueryCommand({
        TableName: TABLE_NAME,
        KeyConditionExpression: 'PK = :pk AND begins_with(SK, :prefix)',
        FilterExpression: 'id = :id',
        ExpressionAttributeValues: { ':pk': PK, ':prefix': SKPrefix, ':id': expenseId },
        Limit: 1,
      })
    );
    const item = result.Items?.[0] as ExpenseItem | undefined;
    if (!item) return null;
    const splits = await getSplitsForExpense(tripId, expenseId);
    return itemToExpense(item, splits);
  }

  async findByTrip(tripId: string): Promise<Expense[]> {
    const { PK, SKPrefix } = keys.prefixes.expenses(tripId);
    const expResult = await ddb.send(
      new QueryCommand({
        TableName: TABLE_NAME,
        KeyConditionExpression: 'PK = :pk AND begins_with(SK, :prefix)',
        ExpressionAttributeValues: { ':pk': PK, ':prefix': SKPrefix },
        ScanIndexForward: false, // newest first
      })
    );
    const expItems = (expResult.Items ?? []) as ExpenseItem[];
    if (expItems.length === 0) return [];

    // Fetch all splits for the trip at once
    const { PK: splitPK } = keys.prefixes.splitsForExpense(tripId, '');
    const splitResult = await ddb.send(
      new QueryCommand({
        TableName: TABLE_NAME,
        KeyConditionExpression: 'PK = :pk AND begins_with(SK, :prefix)',
        ExpressionAttributeValues: { ':pk': `TRIP#${tripId}`, ':prefix': 'SPLIT#' },
      })
    );
    const allSplits = (splitResult.Items ?? []) as SplitItem[];
    const splitsByExpense = new Map<string, SplitItem[]>();
    for (const s of allSplits) {
      const list = splitsByExpense.get(s.expense_id) ?? [];
      list.push(s);
      splitsByExpense.set(s.expense_id, list);
    }

    return Promise.all(
      expItems.map((item) => itemToExpense(item, splitsByExpense.get(item.id) ?? []))
    );
  }

  async create(
    tripId: string,
    data: CreateExpenseRequest,
    currency: string,
    splits: ComputedSplit[]
  ): Promise<Expense> {
    const now = new Date().toISOString();
    const expenseId = uuidv4();

    const expItem: ExpenseItem = {
      ...keys.expense(tripId, now, expenseId),
      type: 'EXPENSE',
      id: expenseId,
      trip_id: tripId,
      paid_by_member_id: data.paid_by_member_id,
      title: data.title.trim(),
      amount: data.amount,
      currency,
      split_type: data.split_type,
      created_by_member_id: data.created_by_member_id,
      created_at: now,
      updated_at: now,
    };

    const splitItems: SplitItem[] = splits.map((s) => ({
      ...keys.split(tripId, expenseId, s.member_id),
      type: 'SPLIT' as const,
      id: uuidv4(),
      expense_id: expenseId,
      trip_id: tripId,
      member_id: s.member_id,
      amount: s.amount,
      percentage: s.percentage,
      created_at: now,
    }));

    await ddb.send(
      new TransactWriteCommand({
        TransactItems: [
          { Put: { TableName: TABLE_NAME, Item: expItem } },
          ...splitItems.map((s) => ({ Put: { TableName: TABLE_NAME, Item: s } })),
        ],
      })
    );

    await dyLogActivity(
      tripId,
      'EXPENSE_ADDED',
      { expense_id: expenseId, title: expItem.title, amount: expItem.amount },
      data.created_by_member_id
    );

    return itemToExpense(expItem, splitItems);
  }

  async update(
    tripId: string,
    expenseId: string,
    data: UpdateExpenseRequest,
    newSplits: ComputedSplit[] | null,
    actorMemberId?: string
  ): Promise<Expense | null> {
    const existing = await this.findById(tripId, expenseId);
    if (!existing) return null;

    const now = new Date().toISOString();

    // Build expense update
    const updatedItem: ExpenseItem = {
      ...keys.expense(tripId, existing.created_at, expenseId),
      type: 'EXPENSE',
      id: expenseId,
      trip_id: tripId,
      paid_by_member_id: data.paid_by_member_id ?? existing.paid_by_member_id,
      title: (data.title ?? existing.title).trim(),
      amount: data.amount ?? existing.amount,
      currency: existing.currency,
      split_type: data.split_type ?? existing.split_type,
      receipt_s3_key: existing.receipt_url ? undefined : undefined,
      created_by_member_id: existing.created_by_member_id,
      created_at: existing.created_at,
      updated_at: now,
    };

    let finalSplitItems: SplitItem[];

    if (newSplits) {
      // Delete old splits and write new ones in a transaction
      const oldSplits = await getSplitsForExpense(tripId, expenseId);
      finalSplitItems = newSplits.map((s) => ({
        ...keys.split(tripId, expenseId, s.member_id),
        type: 'SPLIT' as const,
        id: uuidv4(),
        expense_id: expenseId,
        trip_id: tripId,
        member_id: s.member_id,
        amount: s.amount,
        percentage: s.percentage,
        created_at: now,
      }));

      await ddb.send(
        new TransactWriteCommand({
          TransactItems: [
            { Put: { TableName: TABLE_NAME, Item: updatedItem } },
            ...oldSplits.map((s) => ({
              Delete: { TableName: TABLE_NAME, Key: { PK: s.PK, SK: s.SK } },
            })),
            ...finalSplitItems.map((s) => ({ Put: { TableName: TABLE_NAME, Item: s } })),
          ],
        })
      );
    } else {
      await ddb.send(new PutCommand({ TableName: TABLE_NAME, Item: updatedItem }));
      finalSplitItems = await getSplitsForExpense(tripId, expenseId);
    }

    await dyLogActivity(
      tripId,
      'EXPENSE_UPDATED',
      { expense_id: expenseId, title: updatedItem.title, amount: updatedItem.amount },
      actorMemberId
    );

    return itemToExpense(updatedItem, finalSplitItems);
  }

  async remove(tripId: string, expenseId: string, actorMemberId?: string): Promise<Expense | null> {
    const existing = await this.findById(tripId, expenseId);
    if (!existing) return null;

    const splits = await getSplitsForExpense(tripId, expenseId);

    await ddb.send(
      new TransactWriteCommand({
        TransactItems: [
          {
            Delete: {
              TableName: TABLE_NAME,
              Key: keys.expense(tripId, existing.created_at, expenseId),
            },
          },
          ...splits.map((s) => ({
            Delete: { TableName: TABLE_NAME, Key: { PK: s.PK, SK: s.SK } },
          })),
        ],
      })
    );

    await dyLogActivity(
      tripId,
      'EXPENSE_DELETED',
      { expense_id: expenseId, title: existing.title, amount: existing.amount },
      actorMemberId
    );

    return existing;
  }

  async attachReceipt(tripId: string, expenseId: string, s3Key: string): Promise<void> {
    const existing = await this.findById(tripId, expenseId);
    if (!existing) return;
    await ddb.send(
      new UpdateCommand({
        TableName: TABLE_NAME,
        Key: keys.expense(tripId, existing.created_at, expenseId),
        UpdateExpression: 'SET receipt_s3_key = :key, updated_at = :now',
        ExpressionAttributeValues: { ':key': s3Key, ':now': new Date().toISOString() },
      })
    );
  }

  async findForBalance(tripId: string): Promise<ExpenseForBalance[]> {
    const { PK } = keys.prefixes.expenses(tripId);
    const [expResult, splitResult] = await Promise.all([
      ddb.send(
        new QueryCommand({
          TableName: TABLE_NAME,
          KeyConditionExpression: 'PK = :pk AND begins_with(SK, :prefix)',
          ExpressionAttributeValues: { ':pk': `TRIP#${tripId}`, ':prefix': 'EXPENSE#' },
        })
      ),
      ddb.send(
        new QueryCommand({
          TableName: TABLE_NAME,
          KeyConditionExpression: 'PK = :pk AND begins_with(SK, :prefix)',
          ExpressionAttributeValues: { ':pk': `TRIP#${tripId}`, ':prefix': 'SPLIT#' },
        })
      ),
    ]);

    const splitsByExpense = new Map<string, Array<{ member_id: string; amount: number }>>();
    for (const s of (splitResult.Items ?? []) as SplitItem[]) {
      const list = splitsByExpense.get(s.expense_id) ?? [];
      list.push({ member_id: s.member_id, amount: s.amount });
      splitsByExpense.set(s.expense_id, list);
    }

    return (expResult.Items ?? []).map((item) => {
      const e = item as ExpenseItem;
      return {
        expense_id: e.id,
        paid_by_member_id: e.paid_by_member_id,
        paid_amount: e.amount,
        splits: splitsByExpense.get(e.id) ?? [],
      };
    });
  }
}
