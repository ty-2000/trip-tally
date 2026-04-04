import {
  simplifyDebts,
  computeEqualSplits,
  percentagesToCents,
  validatePercentageSplits,
} from '../debtSimplification';
import type { Balance } from '../../../../shared/types';

describe('simplifyDebts', () => {
  it('returns empty array when all balances are zero', () => {
    const balances: Balance[] = [
      { member_id: 'a', member_name: 'Alice', net_balance: 0 },
      { member_id: 'b', member_name: 'Bob', net_balance: 0 },
    ];
    expect(simplifyDebts(balances)).toEqual([]);
  });

  it('produces one transaction for a simple two-person debt', () => {
    const balances: Balance[] = [
      { member_id: 'a', member_name: 'Alice', net_balance: 1000 },
      { member_id: 'b', member_name: 'Bob', net_balance: -1000 },
    ];
    const result = simplifyDebts(balances);
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      from_member_id: 'b',
      to_member_id: 'a',
      amount: 1000,
    });
  });

  it('minimizes transactions for three-person scenario', () => {
    // Alice paid for everything: owes +2000, Bob owes -1000, Carol owes -1000
    const balances: Balance[] = [
      { member_id: 'a', member_name: 'Alice', net_balance: 2000 },
      { member_id: 'b', member_name: 'Bob', net_balance: -1000 },
      { member_id: 'c', member_name: 'Carol', net_balance: -1000 },
    ];
    const result = simplifyDebts(balances);
    // Optimal: Bob -> Alice (1000), Carol -> Alice (1000) — 2 transactions
    expect(result).toHaveLength(2);
    const totalAmount = result.reduce((sum, s) => sum + s.amount, 0);
    expect(totalAmount).toBe(2000);
  });

  it('handles a complex four-person scenario with minimal transactions', () => {
    const balances: Balance[] = [
      { member_id: 'a', member_name: 'Alice', net_balance: 3000 },
      { member_id: 'b', member_name: 'Bob', net_balance: -1000 },
      { member_id: 'c', member_name: 'Carol', net_balance: -1000 },
      { member_id: 'd', member_name: 'Dave', net_balance: -1000 },
    ];
    const result = simplifyDebts(balances);
    expect(result.length).toBeLessThanOrEqual(3); // at most n-1
    const totalPaid = result.reduce((sum, s) => sum + s.amount, 0);
    expect(totalPaid).toBe(3000);
  });

  it('net balances sum to zero (invariant)', () => {
    const balances: Balance[] = [
      { member_id: 'a', member_name: 'Alice', net_balance: 1500 },
      { member_id: 'b', member_name: 'Bob', net_balance: -500 },
      { member_id: 'c', member_name: 'Carol', net_balance: -1000 },
    ];
    const result = simplifyDebts(balances);
    // All debtor amounts should be fully covered
    const totalFrom = result.reduce((sum, s) => sum + s.amount, 0);
    expect(totalFrom).toBe(1500);
  });
});

describe('computeEqualSplits', () => {
  it('splits evenly when divisible', () => {
    const splits = computeEqualSplits(300, ['a', 'b', 'c']);
    expect(splits.every((s) => s.amount === 100)).toBe(true);
    expect(splits.reduce((sum, s) => sum + s.amount, 0)).toBe(300);
  });

  it('distributes remainder cents to first members', () => {
    const splits = computeEqualSplits(100, ['a', 'b', 'c']);
    const amounts = splits.map((s) => s.amount);
    // 100 / 3 = 33 with remainder 1; first member gets 34
    expect(amounts[0]).toBe(34);
    expect(amounts[1]).toBe(33);
    expect(amounts[2]).toBe(33);
    expect(splits.reduce((sum, s) => sum + s.amount, 0)).toBe(100);
  });

  it('returns empty array for empty member list', () => {
    expect(computeEqualSplits(1000, [])).toEqual([]);
  });

  it('always sums exactly to total', () => {
    for (let total = 1; total <= 100; total++) {
      for (let n = 1; n <= 5; n++) {
        const ids = Array.from({ length: n }, (_, i) => String(i));
        const splits = computeEqualSplits(total, ids);
        const sum = splits.reduce((acc, s) => acc + s.amount, 0);
        expect(sum).toBe(total);
      }
    }
  });
});

describe('validatePercentageSplits', () => {
  it('returns true when percentages sum to exactly 100', () => {
    expect(validatePercentageSplits([50, 25, 25])).toBe(true);
  });

  it('returns true within 0.01 tolerance', () => {
    expect(validatePercentageSplits([33.33, 33.33, 33.34])).toBe(true);
  });

  it('returns false when sum is too low', () => {
    expect(validatePercentageSplits([40, 40])).toBe(false);
  });
});

describe('percentagesToCents', () => {
  it('converts percentages to cents summing to total', () => {
    const result = percentagesToCents(1000, [
      { member_id: 'a', percentage: 50 },
      { member_id: 'b', percentage: 50 },
    ]);
    expect(result[0].amount + result[1].amount).toBe(1000);
    expect(result[0].amount).toBe(500);
  });

  it('handles uneven percentages by distributing remainder', () => {
    const result = percentagesToCents(100, [
      { member_id: 'a', percentage: 33.33 },
      { member_id: 'b', percentage: 33.33 },
      { member_id: 'c', percentage: 33.34 },
    ]);
    const total = result.reduce((sum, r) => sum + r.amount, 0);
    expect(total).toBe(100);
  });
});
