import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

interface TripStore {
  // Maps tripId -> memberId (who the user identified as)
  memberIdsByTrip: Record<string, string>;
  memberNamesByTrip: Record<string, string>;

  setCurrentMember: (tripId: string, memberId: string, memberName: string) => void;
  getCurrentMemberId: (tripId: string) => string | null;
  getCurrentMemberName: (tripId: string) => string | null;
  clearMember: (tripId: string) => void;
}

export const useTripStore = create<TripStore>()(
  persist(
    (set, get) => ({
      memberIdsByTrip: {},
      memberNamesByTrip: {},

      setCurrentMember: (tripId, memberId, memberName) =>
        set((state) => ({
          memberIdsByTrip: { ...state.memberIdsByTrip, [tripId]: memberId },
          memberNamesByTrip: { ...state.memberNamesByTrip, [tripId]: memberName },
        })),

      getCurrentMemberId: (tripId) => get().memberIdsByTrip[tripId] ?? null,

      getCurrentMemberName: (tripId) => get().memberNamesByTrip[tripId] ?? null,

      clearMember: (tripId) =>
        set((state) => {
          const { [tripId]: _mid, ...restIds } = state.memberIdsByTrip;
          const { [tripId]: _mname, ...restNames } = state.memberNamesByTrip;
          return { memberIdsByTrip: restIds, memberNamesByTrip: restNames };
        }),
    }),
    {
      name: 'trip-tally-store',
      storage: createJSONStorage(() => localStorage),
    }
  )
);
