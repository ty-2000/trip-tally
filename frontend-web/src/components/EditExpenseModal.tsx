'use client';

import { useState } from 'react';
import { useUpdateExpense } from '../hooks/useExpenses';
import { parseToCents, centsToDecimal } from '../utils/currency';
import { SplitEditor } from './SplitEditor';
import type { Expense, Member, SplitType } from '../../../shared/types';

interface Props {
  tripId: string;
  expense: Expense;
  members: Member[];
  currency: string;
  currentMemberId: string;
  onClose: () => void;
}

export function EditExpenseModal({ tripId, expense, members, currency, currentMemberId, onClose }: Props) {
  const [title, setTitle] = useState(expense.title);
  const [amountStr, setAmountStr] = useState(centsToDecimal(expense.amount));
  const [paidBy, setPaidBy] = useState(expense.paid_by_member_id);
  const [splitType, setSplitType] = useState<SplitType>(expense.split_type);

  const initialParticipants = expense.splits.map((s) => s.member_id);
  const initialExact: Record<string, string> = {};
  const initialPercentage: Record<string, string> = {};
  for (const s of expense.splits) {
    initialExact[s.member_id] = centsToDecimal(s.amount);
    if (s.percentage !== undefined) {
      initialPercentage[s.member_id] = String(s.percentage);
    }
  }

  const [participantIds, setParticipantIds] = useState<string[]>(initialParticipants);
  const [exactSplits, setExactSplits] = useState<Record<string, string>>(initialExact);
  const [percentageSplits, setPercentageSplits] = useState<Record<string, string>>(initialPercentage);
  const [error, setError] = useState('');

  const updateExpense = useUpdateExpense(tripId);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    const amountCents = parseToCents(amountStr);
    if (isNaN(amountCents) || amountCents <= 0) {
      setError('Please enter a valid amount.');
      return;
    }

    try {
      const base = {
        paid_by_member_id: paidBy,
        title: title.trim(),
        amount: amountCents,
        split_type: splitType,
        updated_at: expense.updated_at,
      };

      let data;
      if (splitType === 'EQUAL') {
        data = { ...base, participant_ids: participantIds };
      } else if (splitType === 'EXACT') {
        const splits = Object.entries(exactSplits)
          .filter(([, v]) => v !== '' && parseFloat(v) > 0)
          .map(([member_id, v]) => ({ member_id, amount: parseToCents(v) }));
        data = { ...base, splits };
      } else {
        const splits = Object.entries(percentageSplits)
          .filter(([, v]) => v !== '' && parseFloat(v) > 0)
          .map(([member_id, v]) => ({ member_id, percentage: parseFloat(v) }));
        data = { ...base, splits };
      }

      await updateExpense.mutateAsync({ expenseId: expense.id, data });
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update expense.');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative bg-white w-full max-w-lg rounded-t-2xl sm:rounded-2xl p-6 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-lg font-semibold text-gray-900">Edit Expense</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm"
              maxLength={255}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Amount ({currency})</label>
            <input
              type="number"
              min="0.01"
              step="0.01"
              value={amountStr}
              onChange={(e) => setAmountStr(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Paid by</label>
            <select
              value={paidBy}
              onChange={(e) => setPaidBy(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm bg-white"
            >
              {members.map((m) => (
                <option key={m.id} value={m.id}>{m.name}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Split type</label>
            <div className="grid grid-cols-3 gap-2">
              {(['EQUAL', 'EXACT', 'PERCENTAGE'] as const).map((type) => (
                <button
                  key={type}
                  type="button"
                  onClick={() => setSplitType(type)}
                  className={`py-2 text-sm font-medium rounded-lg border ${
                    splitType === type
                      ? 'bg-indigo-600 text-white border-indigo-600'
                      : 'bg-white text-gray-600 border-gray-300 hover:border-indigo-400'
                  }`}
                >
                  {type === 'EQUAL' ? 'Equal' : type === 'EXACT' ? 'Exact' : 'Percent'}
                </button>
              ))}
            </div>
          </div>

          <SplitEditor
            members={members}
            splitType={splitType}
            amountCents={parseToCents(amountStr) || 0}
            currency={currency}
            participantIds={participantIds}
            exactSplits={exactSplits}
            percentageSplits={percentageSplits}
            onParticipantsChange={setParticipantIds}
            onExactSplitsChange={setExactSplits}
            onPercentageSplitsChange={setPercentageSplits}
          />

          {error && (
            <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</p>
          )}

          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2.5 text-sm font-medium text-gray-700 border border-gray-300 rounded-xl hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={updateExpense.isPending}
              className="flex-1 py-2.5 text-sm font-medium text-white bg-indigo-600 rounded-xl hover:bg-indigo-700 disabled:opacity-50"
            >
              {updateExpense.isPending ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
