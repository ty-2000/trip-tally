'use client';

import { formatCents } from '../utils/currency';
import type { Settlement } from '../../../shared/types';

interface Props {
  settlements: Settlement[];
  currency: string;
}

export function SettlementList({ settlements, currency }: Props) {
  if (settlements.length === 0) {
    return (
      <div className="text-center py-6 bg-green-50 rounded-xl border border-green-200">
        <p className="text-green-700 font-medium">All settled up!</p>
        <p className="text-green-600 text-sm mt-1">No payments needed.</p>
      </div>
    );
  }

  return (
    <div>
      <h3 className="text-sm font-semibold text-gray-700 mb-3">
        Suggested payments ({settlements.length})
      </h3>
      <div className="space-y-2">
        {settlements.map((s, i) => (
          <div
            key={i}
            className="flex items-center gap-3 bg-white rounded-xl border border-gray-200 px-4 py-3"
          >
            {/* From */}
            <div className="flex-1 text-right">
              <span className="font-medium text-gray-900">{s.from_member_name}</span>
            </div>

            {/* Arrow + amount */}
            <div className="flex flex-col items-center">
              <span className="text-xs font-semibold text-indigo-600">
                {formatCents(s.amount, currency)}
              </span>
              <svg className="w-5 h-4 text-gray-400 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
              </svg>
            </div>

            {/* To */}
            <div className="flex-1">
              <span className="font-medium text-gray-900">{s.to_member_name}</span>
            </div>
          </div>
        ))}
      </div>

      <p className="text-xs text-gray-400 text-center mt-3">
        These are the minimum transactions needed to settle up.
      </p>
    </div>
  );
}
