'use client';

import { useState } from 'react';
import { useCreateExpense } from '../hooks/useExpenses';
import { parseToCents } from '../utils/currency';
import { SplitEditor } from './SplitEditor';
import { useLocale } from '../i18n/LocaleContext';
import type { Member, SplitType } from '../../../shared/types';

interface Props {
  tripId: string;
  members: Member[];
  currency: string;
  currentMemberId: string;
  onClose: () => void;
}

export function AddExpenseModal({ tripId, members, currency, currentMemberId, onClose }: Props) {
  const { t } = useLocale();
  const [title, setTitle] = useState('');
  const [amountStr, setAmountStr] = useState('');
  const [paidBy, setPaidBy] = useState(currentMemberId);
  const [splitType, setSplitType] = useState<SplitType>('EQUAL');
  const [participantIds, setParticipantIds] = useState<string[]>(members.map((m) => m.id));
  const [exactSplits, setExactSplits] = useState<Record<string, string>>({});
  const [percentageSplits, setPercentageSplits] = useState<Record<string, string>>({});
  const [error, setError] = useState('');

  const createExpense = useCreateExpense(tripId);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    const amountCents = parseToCents(amountStr);
    if (isNaN(amountCents) || amountCents <= 0) {
      setError(t('expense.validAmountError'));
      return;
    }
    if (!title.trim()) {
      setError(t('expense.enterTitleError'));
      return;
    }

    try {
      if (splitType === 'EQUAL') {
        if (participantIds.length === 0) {
          setError(t('expense.selectParticipantError'));
          return;
        }
        await createExpense.mutateAsync({
          paid_by_member_id: paidBy,
          title: title.trim(),
          amount: amountCents,
          split_type: 'EQUAL',
          participant_ids: participantIds,
          created_by_member_id: currentMemberId,
        });
      } else if (splitType === 'EXACT') {
        const splits = Object.entries(exactSplits)
          .filter(([, v]) => v !== '' && parseFloat(v) > 0)
          .map(([member_id, v]) => ({ member_id, amount: parseToCents(v) }));

        await createExpense.mutateAsync({
          paid_by_member_id: paidBy,
          title: title.trim(),
          amount: amountCents,
          split_type: 'EXACT',
          splits,
          created_by_member_id: currentMemberId,
        });
      } else {
        const splits = Object.entries(percentageSplits)
          .filter(([, v]) => v !== '' && parseFloat(v) > 0)
          .map(([member_id, v]) => ({ member_id, percentage: parseFloat(v) }));

        await createExpense.mutateAsync({
          paid_by_member_id: paidBy,
          title: title.trim(),
          amount: amountCents,
          split_type: 'PERCENTAGE',
          splits,
          created_by_member_id: currentMemberId,
        });
      }

      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : t('expense.failedAdd'));
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative bg-white w-full max-w-lg rounded-t-2xl sm:rounded-2xl p-6 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-lg font-semibold text-gray-900">{t('expense.addTitle')}</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              {t('expense.description')} <span className="text-red-500">*</span>
            </label>
            <input
              autoFocus
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder={t('expense.descriptionPlaceholder')}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 text-base"
              maxLength={255}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              {t('expense.amount', { currency })} <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              inputMode="decimal"
              value={amountStr}
              onChange={(e) => setAmountStr(e.target.value)}
              placeholder="0.00"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 text-base"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">{t('expense.paidByLabel')}</label>
            <select
              value={paidBy}
              onChange={(e) => setPaidBy(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 text-base bg-white"
            >
              {members.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name}
                </option>
              ))}
            </select>
          </div>

          {/* Split type selector */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">{t('expense.splitType')}</label>
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
                  {type === 'EQUAL' ? t('expense.splitEqual') : type === 'EXACT' ? t('expense.splitExact') : t('expense.splitPercent')}
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
              {t('expense.cancel')}
            </button>
            <button
              type="submit"
              disabled={createExpense.isPending}
              className="flex-1 py-2.5 text-sm font-medium text-white bg-indigo-600 rounded-xl hover:bg-indigo-700 disabled:opacity-50"
            >
              {createExpense.isPending ? t('expense.saving') : t('expense.save')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
