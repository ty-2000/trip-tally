import type { Balance, Settlement } from '../../../shared/types';

/**
 * Greedy debt simplification algorithm.
 *
 * Given a list of net balances (positive = owed money, negative = owes money),
 * produces the minimum set of peer-to-peer transactions needed to settle all debts.
 *
 * The algorithm matches the largest creditor against the largest debtor at each
 * step, producing at most n-1 transactions for n members — which is optimal in
 * the general case.
 *
 * All amounts must be in integer cents to avoid floating-point drift.
 */
export function simplifyDebts(balances: Balance[]): Settlement[] {
  const creditors: Array<{ member_id: string; member_name: string; amount: number }> = [];
  const debtors: Array<{ member_id: string; member_name: string; amount: number }> = [];

  for (const b of balances) {
    if (b.net_balance > 0) {
      creditors.push({
        member_id: b.member_id,
        member_name: b.member_name,
        amount: b.net_balance,
      });
    } else if (b.net_balance < 0) {
      debtors.push({
        member_id: b.member_id,
        member_name: b.member_name,
        amount: -b.net_balance, // work with positive values internally
      });
    }
    // members with net_balance === 0 need no transactions
  }

  // Sort descending so we settle the largest obligations first (fewer iterations in practice)
  creditors.sort((a, b) => b.amount - a.amount);
  debtors.sort((a, b) => b.amount - a.amount);

  const settlements: Settlement[] = [];
  let ci = 0;
  let di = 0;

  while (ci < creditors.length && di < debtors.length) {
    const creditor = creditors[ci];
    const debtor = debtors[di];
    const amount = Math.min(creditor.amount, debtor.amount);

    if (amount > 0) {
      settlements.push({
        from_member_id: debtor.member_id,
        from_member_name: debtor.member_name,
        to_member_id: creditor.member_id,
        to_member_name: creditor.member_name,
        amount,
      });
    }

    creditor.amount -= amount;
    debtor.amount -= amount;

    if (creditor.amount === 0) ci++;
    if (debtor.amount === 0) di++;
  }

  return settlements;
}

/**
 * Compute equal splits for an expense, distributing any remainder cents
 * to the first members in the list to ensure amounts sum exactly to total.
 */
export function computeEqualSplits(
  totalCents: number,
  memberIds: string[]
): Array<{ member_id: string; amount: number }> {
  if (memberIds.length === 0) return [];

  const base = Math.floor(totalCents / memberIds.length);
  const remainder = totalCents % memberIds.length;

  return memberIds.map((member_id, i) => ({
    member_id,
    amount: base + (i < remainder ? 1 : 0),
  }));
}

/**
 * Validate that percentage splits sum to 100 (within 0.01 tolerance).
 */
export function validatePercentageSplits(
  percentages: number[]
): boolean {
  const sum = percentages.reduce((acc, p) => acc + p, 0);
  return Math.abs(sum - 100) <= 0.01;
}

/**
 * Convert percentage splits to cent amounts, distributing remainder cents.
 */
export function percentagesToCents(
  totalCents: number,
  splits: Array<{ member_id: string; percentage: number }>
): Array<{ member_id: string; amount: number; percentage: number }> {
  const exact = splits.map((s) => totalCents * (s.percentage / 100));
  const floored = exact.map(Math.floor);
  const totalFloored = floored.reduce((a, b) => a + b, 0);
  const remainder = totalCents - totalFloored;

  // Distribute remainder cents to members with the largest fractional parts
  const fractionals = exact.map((e, i) => ({ i, frac: e - floored[i] }));
  fractionals.sort((a, b) => b.frac - a.frac);

  const amounts = [...floored];
  for (let j = 0; j < remainder; j++) {
    amounts[fractionals[j].i] += 1;
  }

  return splits.map((s, i) => ({
    member_id: s.member_id,
    amount: amounts[i],
    percentage: s.percentage,
  }));
}
