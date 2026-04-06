import { query } from '../db/client';
import { simplifyDebts } from './debtSimplification';
import type { Balance, Settlement } from '../../../shared/types';

interface SplitRow {
  expense_id: string;
  paid_by_member_id: string;
  paid_amount: number;
  split_member_id: string;
  split_amount: number;
}

interface MemberRow {
  id: string;
  name: string;
}

export async function calculateBalances(
  tripId: string
): Promise<{ balances: Balance[]; settlements: Settlement[] }> {
  // Fetch all members for the trip
  const members = await query<MemberRow>(
    `SELECT id, name FROM members WHERE trip_id = $1`,
    [tripId]
  );

  if (members.length === 0) {
    return { balances: [], settlements: [] };
  }

  const memberMap = new Map(members.map((m) => [m.id, m.name]));

  // Initialize all members with zero balance
  const netBalances = new Map<string, number>(
    members.map((m) => [m.id, 0])
  );

  // Fetch all expense splits joined with expense payer info
  const rows = await query<SplitRow>(
    `SELECT
       e.id AS expense_id,
       e.paid_by_member_id,
       e.amount AS paid_amount,
       s.member_id AS split_member_id,
       s.amount    AS split_amount
     FROM expenses e
     JOIN expense_splits s ON s.expense_id = e.id
     WHERE e.trip_id = $1`,
    [tripId]
  );

  for (const row of rows) {
    // Payer is credited the full expense amount
    const currentPayer = netBalances.get(row.paid_by_member_id) ?? 0;
    netBalances.set(row.paid_by_member_id, currentPayer + row.paid_amount);

    // Each participant in the split is debited their share
    const currentSplitMember = netBalances.get(row.split_member_id) ?? 0;
    netBalances.set(row.split_member_id, currentSplitMember - row.split_amount);
  }

  const balances: Balance[] = members.map((m) => ({
    member_id: m.id,
    member_name: memberMap.get(m.id) ?? m.id,
    net_balance: netBalances.get(m.id) ?? 0,
  }));

  const settlements = simplifyDebts(balances);

  return { balances, settlements };
}
