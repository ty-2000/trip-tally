'use client';

import { useState } from 'react';
import { formatCents } from '../utils/currency';
import { useDeleteExpense } from '../hooks/useExpenses';
import { EditExpenseModal } from './EditExpenseModal';
import type { Expense, Member } from '../../../shared/types';

interface Props {
  tripId: string;
  expenses: Expense[];
  members: Member[];
  currency: string;
  currentMemberId: string | null;
}

export function ExpenseList({ tripId, expenses, members, currency, currentMemberId }: Props) {
  const [editingExpense, setEditingExpense] = useState<Expense | null>(null);
  const deleteExpense = useDeleteExpense(tripId);

  const memberMap = new Map(members.map((m) => [m.id, m.name]));

  if (expenses.length === 0) {
    return (
      <div className="text-center py-12 text-gray-400">
        <svg className="w-12 h-12 mx-auto mb-3 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
            d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
        </svg>
        <p>No expenses yet. Add the first one!</p>
      </div>
    );
  }

  const handleDelete = async (expense: Expense) => {
    if (!confirm(`Delete "${expense.title}"?`)) return;
    await deleteExpense.mutateAsync({
      expenseId: expense.id,
      actorMemberId: currentMemberId ?? undefined,
    });
  };

  return (
    <>
      <div className="space-y-3">
        {expenses.map((expense) => {
          const paidByName = memberMap.get(expense.paid_by_member_id) ?? 'Unknown';
          const myShare = expense.splits.find((s) => s.member_id === currentMemberId);

          return (
            <div
              key={expense.id}
              className="bg-white rounded-xl border border-gray-200 p-4 hover:border-gray-300"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <h3 className="font-medium text-gray-900 truncate">{expense.title}</h3>
                  <p className="text-sm text-gray-500 mt-0.5">
                    Paid by{' '}
                    <span className="font-medium text-gray-700">{paidByName}</span>
                  </p>
                  {myShare && (
                    <p className="text-xs text-indigo-600 mt-1">
                      Your share: {formatCents(myShare.amount, currency)}
                    </p>
                  )}
                  {expense.receipt_url && (
                    <a
                      href={expense.receipt_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs text-blue-500 hover:underline mt-1 inline-block"
                    >
                      View receipt
                    </a>
                  )}
                </div>

                <div className="flex items-center gap-2">
                  <span className="text-lg font-semibold text-gray-900">
                    {formatCents(expense.amount, currency)}
                  </span>

                  {currentMemberId && (
                    <div className="flex gap-1">
                      <button
                        onClick={() => setEditingExpense(expense)}
                        className="p-1.5 text-gray-400 hover:text-indigo-600 rounded"
                        title="Edit expense"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                            d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                        </svg>
                      </button>
                      <button
                        onClick={() => handleDelete(expense)}
                        className="p-1.5 text-gray-400 hover:text-red-600 rounded"
                        title="Delete expense"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                            d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      </button>
                    </div>
                  )}
                </div>
              </div>

              {/* Split breakdown */}
              <div className="mt-3 pt-3 border-t border-gray-100">
                <p className="text-xs text-gray-400 mb-1">
                  Split {expense.split_type.toLowerCase()} among {expense.splits.length}
                </p>
                <div className="flex flex-wrap gap-2">
                  {expense.splits.map((split) => (
                    <span
                      key={split.member_id}
                      className="text-xs bg-gray-100 text-gray-600 rounded px-2 py-0.5"
                    >
                      {memberMap.get(split.member_id) ?? '?'}: {formatCents(split.amount, currency)}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {editingExpense && (
        <EditExpenseModal
          tripId={tripId}
          expense={editingExpense}
          members={members}
          currency={currency}
          currentMemberId={currentMemberId ?? ''}
          onClose={() => setEditingExpense(null)}
        />
      )}
    </>
  );
}
