import type {
  TripSummaryResponse,
  TripResponse,
  MemberResponse,
  ExpenseResponse,
  ExpenseListResponse,
  BalancesResponse,
  ActivityResponse,
  UploadUrlResponse,
  CreateTripRequest,
  UpdateTripRequest,
  CreateMemberRequest,
  CreateExpenseRequest,
  UpdateExpenseRequest,
  UploadUrlRequest,
} from '../../../shared/types';

const BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? '';

class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
    public details?: unknown
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

async function request<T>(
  method: string,
  path: string,
  body?: unknown
): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

  if (res.status === 204) return undefined as T;

  const data = await res.json();

  if (!res.ok) {
    throw new ApiError(res.status, data.error ?? 'Request failed', data.details);
  }

  return data as T;
}

export const api = {
  trips: {
    create: (data: CreateTripRequest) =>
      request<TripResponse>('POST', '/trips', data),

    get: (tripId: string) =>
      request<TripSummaryResponse>('GET', `/trips/${tripId}`),

    update: (tripId: string, data: UpdateTripRequest) =>
      request<TripResponse>('PATCH', `/trips/${tripId}`, data),
  },

  members: {
    create: (tripId: string, data: CreateMemberRequest) =>
      request<MemberResponse>('POST', `/trips/${tripId}/members`, data),

    list: (tripId: string) =>
      request<{ members: MemberResponse['member'][] }>('GET', `/trips/${tripId}/members`),

    remove: (tripId: string, memberId: string) =>
      request<void>('DELETE', `/trips/${tripId}/members/${memberId}`),
  },

  expenses: {
    create: (tripId: string, data: CreateExpenseRequest) =>
      request<ExpenseResponse>('POST', `/trips/${tripId}/expenses`, data),

    list: (tripId: string) =>
      request<ExpenseListResponse>('GET', `/trips/${tripId}/expenses`),

    get: (tripId: string, expenseId: string) =>
      request<ExpenseResponse>('GET', `/trips/${tripId}/expenses/${expenseId}`),

    update: (tripId: string, expenseId: string, data: UpdateExpenseRequest) =>
      request<ExpenseResponse>('PATCH', `/trips/${tripId}/expenses/${expenseId}`, data),

    delete: (tripId: string, expenseId: string, actorMemberId?: string) => {
      const qs = actorMemberId ? `?actor_member_id=${actorMemberId}` : '';
      return request<void>('DELETE', `/trips/${tripId}/expenses/${expenseId}${qs}`);
    },
  },

  uploads: {
    getUrl: (tripId: string, expenseId: string, data: UploadUrlRequest) =>
      request<UploadUrlResponse>('POST', `/trips/${tripId}/expenses/${expenseId}/upload-url`, data),

    confirm: (tripId: string, expenseId: string, s3Key: string) =>
      request<{ message: string }>('PATCH', `/trips/${tripId}/expenses/${expenseId}/receipt`, { s3_key: s3Key }),

    uploadToS3: async (uploadUrl: string, file: File): Promise<void> => {
      const res = await fetch(uploadUrl, {
        method: 'PUT',
        body: file,
        headers: { 'Content-Type': file.type },
      });
      if (!res.ok) throw new ApiError(res.status, 'S3 upload failed');
    },
  },

  balances: {
    get: (tripId: string) =>
      request<BalancesResponse>('GET', `/trips/${tripId}/balances`),
  },

  activity: {
    list: (tripId: string, cursor?: string) => {
      const qs = cursor ? `?cursor=${cursor}` : '';
      return request<ActivityResponse>('GET', `/trips/${tripId}/activity${qs}`);
    },
  },
};

export { ApiError };
