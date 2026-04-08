import { tripRepo, expenseRepo } from '../repositories/postgres';
import { computeEqualSplits, percentagesToCents, validatePercentageSplits } from './debtSimplification';
import { NotFoundError, BadRequestError } from '../utils/response';
import type { Expense, CreateExpenseRequest, UpdateExpenseRequest } from '../../../shared/types';
import type { ComputedSplit } from '../repositories/types';

function computeSplits(
  totalCents: number,
  splitType: Expense['split_type'],
  data: CreateExpenseRequest | UpdateExpenseRequest
): ComputedSplit[] {
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

export async function createExpense(tripId: string, data: CreateExpenseRequest): Promise<Expense> {
  const currency = await tripRepo.getTripCurrency(tripId);
  if (!currency) throw new NotFoundError(`Trip ${tripId} not found`);

  const splits = computeSplits(data.amount, data.split_type, data);
  return expenseRepo.create(tripId, data, currency, splits);
}

export async function getExpenses(tripId: string): Promise<Expense[]> {
  return expenseRepo.findByTrip(tripId);
}

export async function getExpense(tripId: string, expenseId: string): Promise<Expense> {
  const expense = await expenseRepo.findById(tripId, expenseId);
  if (!expense) throw new NotFoundError(`Expense ${expenseId} not found`);
  return expense;
}

export async function updateExpense(
  tripId: string,
  expenseId: string,
  data: UpdateExpenseRequest,
  actorMemberId?: string
): Promise<Expense> {
  const existing = await expenseRepo.findById(tripId, expenseId);
  if (!existing) throw new NotFoundError(`Expense ${expenseId} not found`);

  if (data.updated_at && data.updated_at !== existing.updated_at) {
    throw new BadRequestError(
      'Expense was modified by someone else. Please refresh and try again.'
    );
  }

  const newAmount = data.amount ?? existing.amount;
  const newSplitType = (data.split_type ?? existing.split_type) as Expense['split_type'];

  let newSplits: ComputedSplit[] | null = null;
  if (data.split_type || data.splits || data.participant_ids) {
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

  const updated = await expenseRepo.update(tripId, expenseId, data, newSplits, actorMemberId);
  if (!updated) throw new NotFoundError(`Expense ${expenseId} not found`);
  return updated;
}

export async function deleteExpense(
  tripId: string,
  expenseId: string,
  actorMemberId?: string
): Promise<void> {
  const deleted = await expenseRepo.remove(tripId, expenseId, actorMemberId);
  if (!deleted) throw new NotFoundError(`Expense ${expenseId} not found`);
}

export async function attachReceipt(
  tripId: string,
  expenseId: string,
  s3Key: string
): Promise<void> {
  await expenseRepo.attachReceipt(tripId, expenseId, s3Key);
}
