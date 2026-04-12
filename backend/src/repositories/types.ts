import type {
  Trip,
  Member,
  Expense,
  ActivityEvent,
  ActivityEventType,
  CreateTripRequest,
  UpdateTripRequest,
  CreateExpenseRequest,
  UpdateExpenseRequest,
} from '../../../shared/types';

export interface ComputedSplit {
  member_id: string;
  amount: number;
  percentage?: number;
}

export interface ExpenseForBalance {
  expense_id: string;
  paid_by_member_id: string;
  paid_amount: number;
  splits: Array<{ member_id: string; amount: number }>;
}

export interface ITripRepository {
  findById(tripId: string): Promise<Trip | null>;
  create(data: CreateTripRequest): Promise<Trip>;
  update(tripId: string, data: UpdateTripRequest): Promise<Trip | null>;
  getTripCurrency(tripId: string): Promise<string | null>;
}

export interface IMemberRepository {
  findById(tripId: string, memberId: string): Promise<Member | null>;
  findByTrip(tripId: string): Promise<Member[]>;
  create(tripId: string, name: string): Promise<Member>;
  remove(tripId: string, memberId: string): Promise<Member | null>;
  hasSplits(tripId: string, memberId: string): Promise<boolean>;
  hasPaidExpenses(tripId: string, memberId: string): Promise<boolean>;
}

export interface IExpenseRepository {
  findById(tripId: string, expenseId: string): Promise<Expense | null>;
  findByTrip(tripId: string): Promise<Expense[]>;
  create(
    tripId: string,
    data: CreateExpenseRequest,
    currency: string,
    splits: ComputedSplit[]
  ): Promise<Expense>;
  update(
    tripId: string,
    expenseId: string,
    data: UpdateExpenseRequest,
    newSplits: ComputedSplit[] | null,
    actorMemberId?: string
  ): Promise<Expense | null>;
  remove(tripId: string, expenseId: string, actorMemberId?: string): Promise<Expense | null>;
  attachReceipt(tripId: string, expenseId: string, s3Key: string): Promise<void>;
  findForBalance(tripId: string): Promise<ExpenseForBalance[]>;
}

export interface IActivityRepository {
  log(
    tripId: string,
    eventType: ActivityEventType,
    metadata: Record<string, any>,
    memberId?: string
  ): Promise<void>;
  list(
    tripId: string,
    cursor?: string,
    limit?: number
  ): Promise<{ events: ActivityEvent[]; nextCursor?: string }>;
}
