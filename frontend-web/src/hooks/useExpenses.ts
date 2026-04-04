'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../api/client';
import { TRIP_KEY } from './useTrip';
import type {
  CreateExpenseRequest,
  UpdateExpenseRequest,
  TripSummaryResponse,
  Expense,
} from '../../../shared/types';

export function useCreateExpense(tripId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: CreateExpenseRequest) => api.expenses.create(tripId, data),
    onSuccess: (response) => {
      queryClient.setQueryData(
        TRIP_KEY(tripId),
        (old: TripSummaryResponse | undefined) => {
          if (!old) return old;
          return {
            ...old,
            expenses: [response.expense, ...old.expenses],
          };
        }
      );
      // Invalidate to refetch balances (recalculated server-side)
      queryClient.invalidateQueries({ queryKey: TRIP_KEY(tripId) });
    },
  });
}

export function useUpdateExpense(tripId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ expenseId, data }: { expenseId: string; data: UpdateExpenseRequest }) =>
      api.expenses.update(tripId, expenseId, data),
    onSuccess: (response) => {
      queryClient.setQueryData(
        TRIP_KEY(tripId),
        (old: TripSummaryResponse | undefined) => {
          if (!old) return old;
          return {
            ...old,
            expenses: old.expenses.map((e) =>
              e.id === response.expense.id ? response.expense : e
            ),
          };
        }
      );
      queryClient.invalidateQueries({ queryKey: TRIP_KEY(tripId) });
    },
  });
}

export function useDeleteExpense(tripId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ expenseId, actorMemberId }: { expenseId: string; actorMemberId?: string }) =>
      api.expenses.delete(tripId, expenseId, actorMemberId),
    // Optimistic update: remove from list immediately
    onMutate: async ({ expenseId }) => {
      await queryClient.cancelQueries({ queryKey: TRIP_KEY(tripId) });
      const snapshot = queryClient.getQueryData<TripSummaryResponse>(TRIP_KEY(tripId));

      queryClient.setQueryData(
        TRIP_KEY(tripId),
        (old: TripSummaryResponse | undefined) => {
          if (!old) return old;
          return {
            ...old,
            expenses: old.expenses.filter((e) => e.id !== expenseId),
          };
        }
      );

      return { snapshot };
    },
    onError: (_err, _vars, context) => {
      // Roll back optimistic update on error
      if (context?.snapshot) {
        queryClient.setQueryData(TRIP_KEY(tripId), context.snapshot);
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: TRIP_KEY(tripId) });
    },
  });
}

export function useUploadReceipt(tripId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ expenseId, file }: { expenseId: string; file: File }) => {
      // Step 1: get presigned URL
      const { upload_url, s3_key } = await api.uploads.getUrl(tripId, expenseId, {
        content_type: file.type,
      });

      // Step 2: upload directly to S3
      await api.uploads.uploadToS3(upload_url, file);

      // Step 3: confirm with backend
      await api.uploads.confirm(tripId, expenseId, s3_key);

      return { expenseId, s3_key };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: TRIP_KEY(tripId) });
    },
  });
}
