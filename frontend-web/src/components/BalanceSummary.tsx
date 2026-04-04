'use client';

import { formatCents } from '../utils/currency';
import type { Balance } from '../../../shared/types';

interface Props {
  balances: Balance[];
  currency: string;
}

export function BalanceSummary({ balances, currency }: Props) {
  if (balances.length === 0) {
    return (
      <div className="text-center py-8 text-gray-400">
        <p>Add expenses to see balances.</p>
      </div>
    );
  }

  const sorted = [...balances].sort((a, b) => b.net_balance - a.net_balance);

  return (
    <div>
      <h3 className="text-sm font-semibold text-gray-700 mb-3">Balances</h3>
      <div className="space-y-2">
        {sorted.map((b) => {
          const isPositive = b.net_balance >= 0;
          const isZero = b.net_balance === 0;

          return (
            <div
              key={b.member_id}
              className="flex items-center justify-between bg-white rounded-xl border border-gray-200 px-4 py-3"
            >
              <span className="font-medium text-gray-800">{b.member_name}</span>
              <div className="text-right">
                <span
                  className={`font-semibold ${
                    isZero
                      ? 'text-gray-400'
                      : isPositive
                      ? 'text-green-600'
                      : 'text-red-500'
                  }`}
                >
                  {isPositive && !isZero ? '+' : ''}
                  {formatCents(b.net_balance, currency)}
                </span>
                <p className="text-xs text-gray-400">
                  {isZero ? 'settled' : isPositive ? 'gets back' : 'owes'}
                </p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
