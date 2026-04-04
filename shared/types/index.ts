export type SplitType = 'EQUAL' | 'EXACT' | 'PERCENTAGE';

export type ActivityEventType =
  | 'TRIP_CREATED'
  | 'MEMBER_JOINED'
  | 'MEMBER_REMOVED'
  | 'EXPENSE_ADDED'
  | 'EXPENSE_UPDATED'
  | 'EXPENSE_DELETED';

export interface Trip {
  id: string;
  name: string;
  description?: string;
  currency: string;
  created_at: string;
  updated_at: string;
}

export interface Member {
  id: string;
  trip_id: string;
  name: string;
  created_at: string;
}

export interface ExpenseSplit {
  id: string;
  expense_id: string;
  member_id: string;
  amount: number; // integer cents
  percentage?: number;
}

export interface Expense {
  id: string;
  trip_id: string;
  paid_by_member_id: string;
  title: string;
  amount: number; // integer cents
  currency: string;
  split_type: SplitType;
  splits: ExpenseSplit[];
  receipt_url?: string;
  created_by_member_id?: string;
  created_at: string;
  updated_at: string;
}

export interface Balance {
  member_id: string;
  member_name: string;
  net_balance: number; // positive = owed money, negative = owes money (cents)
}

export interface Settlement {
  from_member_id: string;
  from_member_name: string;
  to_member_id: string;
  to_member_name: string;
  amount: number; // cents
}

export interface ActivityEvent {
  id: string;
  trip_id: string;
  member_id?: string;
  member_name?: string;
  event_type: ActivityEventType;
  metadata: Record<string, unknown>;
  created_at: string;
}

// API Request Types

export interface CreateTripRequest {
  name: string;
  description?: string;
  currency: string;
}

export interface UpdateTripRequest {
  name?: string;
  description?: string;
}

export interface CreateMemberRequest {
  name: string;
}

export interface CreateExpenseRequest {
  paid_by_member_id: string;
  title: string;
  amount: number; // cents
  split_type: SplitType;
  participant_ids?: string[]; // for EQUAL split
  splits?: Array<{
    member_id: string;
    amount?: number; // for EXACT split (cents)
    percentage?: number; // for PERCENTAGE split
  }>;
  created_by_member_id?: string;
}

export interface UpdateExpenseRequest {
  paid_by_member_id?: string;
  title?: string;
  amount?: number;
  split_type?: SplitType;
  participant_ids?: string[];
  splits?: Array<{
    member_id: string;
    amount?: number;
    percentage?: number;
  }>;
  updated_at?: string; // optimistic concurrency
}

export interface UploadUrlRequest {
  content_type: string; // e.g. "image/jpeg"
}

// API Response Types

export interface TripResponse {
  trip: Trip;
}

export interface TripSummaryResponse {
  trip: Trip;
  members: Member[];
  expenses: Expense[];
  balances: Balance[];
  settlements: Settlement[];
}

export interface MemberResponse {
  member: Member;
}

export interface ExpenseResponse {
  expense: Expense;
}

export interface ExpenseListResponse {
  expenses: Expense[];
}

export interface BalancesResponse {
  balances: Balance[];
  settlements: Settlement[];
}

export interface UploadUrlResponse {
  upload_url: string;
  receipt_url: string;
  s3_key: string;
}

export interface ActivityResponse {
  events: ActivityEvent[];
  next_cursor?: string;
}

export interface ApiError {
  error: string;
  details?: unknown;
}
