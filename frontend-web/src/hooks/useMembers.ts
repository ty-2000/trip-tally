'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../api/client';
import { TRIP_KEY } from './useTrip';
import { useTripStore } from '../store/tripStore';
import type { TripSummaryResponse } from '../../../shared/types';

export function useAddMember(tripId: string) {
  const queryClient = useQueryClient();
  const setCurrentMember = useTripStore((s) => s.setCurrentMember);

  return useMutation({
    mutationFn: (name: string) => api.members.create(tripId, { name }),
    onSuccess: (response) => {
      queryClient.setQueryData(
        TRIP_KEY(tripId),
        (old: TripSummaryResponse | undefined) => {
          if (!old) return old;
          return {
            ...old,
            members: [...old.members, response.member],
          };
        }
      );
      // Auto-select the newly added member as "me"
      setCurrentMember(tripId, response.member.id, response.member.name);
    },
  });
}

export function useRemoveMember(tripId: string) {
  const queryClient = useQueryClient();
  const clearMember = useTripStore((s) => s.clearMember);

  return useMutation({
    mutationFn: (memberId: string) => api.members.remove(tripId, memberId),
    onSuccess: (_data, memberId) => {
      queryClient.setQueryData(
        TRIP_KEY(tripId),
        (old: TripSummaryResponse | undefined) => {
          if (!old) return old;
          return {
            ...old,
            members: old.members.filter((m) => m.id !== memberId),
          };
        }
      );
      queryClient.invalidateQueries({ queryKey: TRIP_KEY(tripId) });

      // Clear if this was the current member
      const currentId = useTripStore.getState().getCurrentMemberId(tripId);
      if (currentId === memberId) clearMember(tripId);
    },
  });
}
