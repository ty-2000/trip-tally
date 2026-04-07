'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../api/client';
import type {
  CreateTripRequest,
  UpdateTripRequest,
  TripSummaryResponse,
} from '../../../shared/types';

export const TRIP_KEY = (tripId: string) => ['trip', tripId] as const;

export function useTripSummary(tripId: string) {
  return useQuery({
    queryKey: TRIP_KEY(tripId),
    queryFn: () => api.trips.get(tripId),
    staleTime: 30_000,
    retry: (failureCount, error) => {
      // Don't retry on 404
      if ((error as { status?: number }).status === 404) return false;
      return failureCount < 3;
    },
  });
}

export function useCreateTrip() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: CreateTripRequest) => api.trips.create(data),
    onSuccess: (response) => {
      queryClient.setQueryData(TRIP_KEY(response.trip.id), (old: TripSummaryResponse | undefined) =>
        old ? { ...old, trip: response.trip } : undefined
      );
    },
  });
}

export function useUpdateTrip(tripId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: UpdateTripRequest) => api.trips.update(tripId, data),
    onSuccess: (response) => {
      queryClient.setQueryData(
        TRIP_KEY(tripId),
        (old: TripSummaryResponse | undefined) =>
          old ? { ...old, trip: response.trip } : undefined
      );
    },
  });
}
