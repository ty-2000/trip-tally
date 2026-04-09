/** Single-table key helpers */

export const keys = {
  tripMeta: (tripId: string) => ({
    PK: `TRIP#${tripId}`,
    SK: 'META',
  }),

  member: (tripId: string, memberId: string) => ({
    PK: `TRIP#${tripId}`,
    SK: `MEMBER#${memberId}`,
  }),

  // Stored with createdAt in SK for chronological Query
  expense: (tripId: string, createdAt: string, expenseId: string) => ({
    PK: `TRIP#${tripId}`,
    SK: `EXPENSE#${createdAt}#${expenseId}`,
  }),

  split: (tripId: string, expenseId: string, memberId: string) => ({
    PK: `TRIP#${tripId}`,
    SK: `SPLIT#${expenseId}#${memberId}`,
  }),

  activity: (tripId: string, createdAt: string, eventId: string) => ({
    PK: `TRIP#${tripId}`,
    SK: `ACTIVITY#${createdAt}#${eventId}`,
  }),

  // Prefix helpers for Query
  prefixes: {
    members: (tripId: string) => ({ PK: `TRIP#${tripId}`, SKPrefix: 'MEMBER#' }),
    expenses: (tripId: string) => ({ PK: `TRIP#${tripId}`, SKPrefix: 'EXPENSE#' }),
    splitsForExpense: (tripId: string, expenseId: string) => ({
      PK: `TRIP#${tripId}`,
      SKPrefix: `SPLIT#${expenseId}#`,
    }),
    activity: (tripId: string) => ({ PK: `TRIP#${tripId}`, SKPrefix: 'ACTIVITY#' }),
  },
};
