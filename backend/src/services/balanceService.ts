import { simplifyDebts } from './debtSimplification';
import type { Member, Balance, Settlement } from '../../../shared/types';
import type { ExpenseForBalance } from '../repositories/types';

export function calculateBalances(
  members: Member[],
  expenses: ExpenseForBalance[]
): { balances: Balance[]; settlements: Settlement[] } {
  const memberMap = new Map(members.map((m) => [m.id, m.name]));
  const netBalances = new Map<string, number>(members.map((m) => [m.id, 0]));

  for (const expense of expenses) {
    const currentPayer = netBalances.get(expense.paid_by_member_id) ?? 0;
    netBalances.set(expense.paid_by_member_id, currentPayer + expense.paid_amount);

    for (const split of expense.splits) {
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
