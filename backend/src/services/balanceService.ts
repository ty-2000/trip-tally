import { query } from '../db/client';
import { simplifyDebts } from './debtSimplification';
import type { Balance, Settlement } from '../../../shared/types';

interface ExpenseRow {
  expense_id: string;
  paid_by_member_id: string;
  paid_amount: number;
  splits: Array<{ member_id: string; amount: number }>;
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

  // Fetch expenses with their splits nested as a JSON array
  const rows = await query<ExpenseRow>(
    `SELECT
       e.id                AS expense_id,
       e.paid_by_member_id,
       e.amount            AS paid_amount,
       json_agg(json_build_object('member_id', s.member_id, 'amount', s.amount)) AS splits
     FROM expenses e
     JOIN expense_splits s ON s.expense_id = e.id
     WHERE e.trip_id = $1
     GROUP BY e.id`,
    [tripId]
  );

  for (const row of rows) {
    // Payer is credited the full expense amount — once per expense
    const currentPayer = netBalances.get(row.paid_by_member_id) ?? 0;
    netBalances.set(row.paid_by_member_id, currentPayer + row.paid_amount);

    // Each participant in the split is debited their share
    for (const split of row.splits) {
      const current = netBalances.get(split.member_id) ?? 0;
      netBalances.set(split.member_id, current - split.amount);
    }
  }

  const balances: Balance[] = members.map((m) => ({
    member_id: m.id,
    member_name: memberMap.get(m.id) ?? m.id,
    net_balance: netBalances.get(m.id) ?? 0,
  }));

  const settlements = simplifyDebts(balances);

  return { balances, settlements };
}
