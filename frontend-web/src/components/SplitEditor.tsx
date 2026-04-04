'use client';

import { formatCents } from '../utils/currency';
import type { Member, SplitType } from '../../../shared/types';

interface Props {
  members: Member[];
  splitType: SplitType;
  amountCents: number;
  currency: string;
  participantIds: string[];
  exactSplits: Record<string, string>;
  percentageSplits: Record<string, string>;
  onParticipantsChange: (ids: string[]) => void;
  onExactSplitsChange: (splits: Record<string, string>) => void;
  onPercentageSplitsChange: (splits: Record<string, string>) => void;
}

export function SplitEditor({
  members,
  splitType,
  amountCents,
  currency,
  participantIds,
  exactSplits,
  percentageSplits,
  onParticipantsChange,
  onExactSplitsChange,
  onPercentageSplitsChange,
}: Props) {
  const toggleParticipant = (memberId: string) => {
    if (participantIds.includes(memberId)) {
      onParticipantsChange(participantIds.filter((id) => id !== memberId));
    } else {
      onParticipantsChange([...participantIds, memberId]);
    }
  };

  const exactSum = Object.values(exactSplits).reduce(
    (sum, v) => sum + (parseFloat(v) || 0) * 100,
    0
  );

  const percentageSum = Object.values(percentageSplits).reduce(
    (sum, v) => sum + (parseFloat(v) || 0),
    0
  );

  if (splitType === 'EQUAL') {
    const perPerson =
      participantIds.length > 0
        ? Math.floor(amountCents / participantIds.length)
        : 0;

    return (
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">Participants</label>
        <div className="space-y-1">
          {members.map((m) => {
            const isSelected = participantIds.includes(m.id);
            return (
              <label key={m.id} className="flex items-center justify-between py-1.5 px-2 rounded-lg hover:bg-gray-50 cursor-pointer">
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={isSelected}
                    onChange={() => toggleParticipant(m.id)}
                    className="rounded text-indigo-600"
                  />
                  <span className="text-sm text-gray-700">{m.name}</span>
                </div>
                {isSelected && amountCents > 0 && (
                  <span className="text-xs text-gray-400">
                    ~{formatCents(perPerson, currency)}
                  </span>
                )}
              </label>
            );
          })}
        </div>
      </div>
    );
  }

  if (splitType === 'EXACT') {
    const remaining = amountCents - Math.round(exactSum);
    return (
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">Exact amounts</label>
        <div className="space-y-2">
          {members.map((m) => (
            <div key={m.id} className="flex items-center gap-2">
              <span className="text-sm text-gray-700 w-24 truncate">{m.name}</span>
              <input
                type="number"
                min="0"
                step="0.01"
                value={exactSplits[m.id] ?? ''}
                onChange={(e) =>
                  onExactSplitsChange({ ...exactSplits, [m.id]: e.target.value })
                }
                placeholder="0.00"
                className="flex-1 px-2 py-1.5 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
          ))}
        </div>
        <p className={`text-xs mt-2 ${Math.abs(remaining) < 1 ? 'text-green-600' : 'text-amber-600'}`}>
          {Math.abs(remaining) < 1
            ? 'Splits balance!'
            : remaining > 0
            ? `Unallocated: ${formatCents(remaining, currency)}`
            : `Over-allocated by: ${formatCents(-remaining, currency)}`}
        </p>
      </div>
    );
  }

  // PERCENTAGE
  const remainingPct = 100 - percentageSum;
  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-2">Percentages</label>
      <div className="space-y-2">
        {members.map((m) => (
          <div key={m.id} className="flex items-center gap-2">
            <span className="text-sm text-gray-700 w-24 truncate">{m.name}</span>
            <input
              type="number"
              min="0"
              max="100"
              step="0.01"
              value={percentageSplits[m.id] ?? ''}
              onChange={(e) =>
                onPercentageSplitsChange({ ...percentageSplits, [m.id]: e.target.value })
              }
              placeholder="0"
              className="flex-1 px-2 py-1.5 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
            <span className="text-sm text-gray-400">%</span>
          </div>
        ))}
      </div>
      <p className={`text-xs mt-2 ${Math.abs(remainingPct) < 0.01 ? 'text-green-600' : 'text-amber-600'}`}>
        {Math.abs(remainingPct) < 0.01
          ? 'Percentages sum to 100%!'
          : `Remaining: ${remainingPct.toFixed(2)}%`}
      </p>
    </div>
  );
}
