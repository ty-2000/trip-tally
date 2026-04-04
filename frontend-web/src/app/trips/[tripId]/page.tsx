'use client';

import { useState } from 'react';
import { useTripSummary } from '../../../hooks/useTrip';
import { useTripStore } from '../../../store/tripStore';
import { ExpenseList } from '../../../components/ExpenseList';
import { AddExpenseModal } from '../../../components/AddExpenseModal';
import { BalanceSummary } from '../../../components/BalanceSummary';
import { SettlementList } from '../../../components/SettlementList';
import { ActivityFeed } from '../../../components/ActivityFeed';
import { MemberManager } from '../../../components/MemberManager';
import { ShareLink } from '../../../components/ShareLink';

type Tab = 'expenses' | 'balances' | 'activity';

interface Props {
  params: { tripId: string };
}

export default function TripPage({ params }: Props) {
  const { tripId } = params;
  const [activeTab, setActiveTab] = useState<Tab>('expenses');
  const [showAddExpense, setShowAddExpense] = useState(false);

  const { data, isLoading, isError, error } = useTripSummary(tripId);
  const getCurrentMemberId = useTripStore((s) => s.getCurrentMemberId);
  const currentMemberId = getCurrentMemberId(tripId);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="w-8 h-8 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          <p className="text-gray-500">Loading trip...</p>
        </div>
      </div>
    );
  }

  if (isError) {
    const status = (error as { status?: number }).status;
    if (status === 404) {
      return (
        <div className="min-h-screen flex items-center justify-center p-4">
          <div className="text-center max-w-sm">
            <h1 className="text-2xl font-bold text-gray-800 mb-2">Trip not found</h1>
            <p className="text-gray-500 mb-6">
              This trip link may be invalid or the trip was deleted.
            </p>
            <a href="/" className="text-indigo-600 hover:underline">
              Create a new trip
            </a>
          </div>
        </div>
      );
    }
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <p className="text-red-600">Failed to load trip. Please refresh.</p>
      </div>
    );
  }

  if (!data) return null;

  const { trip, members, expenses, balances, settlements } = data;

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-2xl mx-auto px-4 py-4 flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-gray-900">{trip.name}</h1>
            <p className="text-sm text-gray-500">{members.length} members</p>
          </div>
          <ShareLink tripId={tripId} />
        </div>
      </header>

      <div className="max-w-2xl mx-auto px-4 py-6 space-y-6">
        {/* Member identity picker */}
        <MemberManager
          tripId={tripId}
          members={members}
          currentMemberId={currentMemberId}
        />

        {/* Tab navigation */}
        <div className="flex border-b border-gray-200">
          {(['expenses', 'balances', 'activity'] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`flex-1 py-2 text-sm font-medium capitalize ${
                activeTab === tab
                  ? 'border-b-2 border-indigo-600 text-indigo-600'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              {tab}
              {tab === 'expenses' && expenses.length > 0 && (
                <span className="ml-1 text-xs bg-indigo-100 text-indigo-700 rounded-full px-1.5">
                  {expenses.length}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* Tab content */}
        {activeTab === 'expenses' && (
          <div className="space-y-4">
            <button
              onClick={() => setShowAddExpense(true)}
              disabled={!currentMemberId}
              className="w-full py-3 bg-indigo-600 text-white font-semibold rounded-xl hover:bg-indigo-700 disabled:opacity-40 disabled:cursor-not-allowed"
              title={!currentMemberId ? 'Select your name above first' : undefined}
            >
              + Add Expense
            </button>

            <ExpenseList
              tripId={tripId}
              expenses={expenses}
              members={members}
              currency={trip.currency}
              currentMemberId={currentMemberId}
            />
          </div>
        )}

        {activeTab === 'balances' && (
          <div className="space-y-6">
            <BalanceSummary
              balances={balances}
              currency={trip.currency}
            />
            <SettlementList
              settlements={settlements}
              currency={trip.currency}
            />
          </div>
        )}

        {activeTab === 'activity' && (
          <ActivityFeed tripId={tripId} />
        )}
      </div>

      {/* Add Expense Modal */}
      {showAddExpense && currentMemberId && (
        <AddExpenseModal
          tripId={tripId}
          members={members}
          currency={trip.currency}
          currentMemberId={currentMemberId}
          onClose={() => setShowAddExpense(false)}
        />
      )}
    </div>
  );
}
