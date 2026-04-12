'use client';

import { useState, useEffect } from 'react';
import { useTripSummary } from '../../../hooks/useTrip';
import { useTripStore } from '../../../store/tripStore';
import { ExpenseList } from '../../../components/ExpenseList';
import { AddExpenseModal } from '../../../components/AddExpenseModal';
import { BalanceSummary } from '../../../components/BalanceSummary';
import { SettlementList } from '../../../components/SettlementList';
import { ActivityFeed } from '../../../components/ActivityFeed';
import { MemberManager } from '../../../components/MemberManager';
import { ShareLink } from '../../../components/ShareLink';
import { useLocale, LanguageSwitcher } from '../../../i18n/LocaleContext';

type Tab = 'expenses' | 'balances' | 'activity';

interface Props {
  params: { tripId: string };
}

export default function TripPage({ params }: Props) {
  const { tripId } = params;
  const { t } = useLocale();
  const [activeTab, setActiveTab] = useState<Tab>('expenses');
  const [showAddExpense, setShowAddExpense] = useState(false);

  const { data, isLoading, isError, error } = useTripSummary(tripId);
  const currentMemberId = useTripStore((s) => s.memberIdsByTrip[tripId] ?? null);
  const recordVisit = useTripStore((s) => s.recordVisit);

  useEffect(() => {
    if (data?.trip) {
      recordVisit(tripId, data.trip.name);
    }
  }, [data?.trip?.name]);

  const TAB_LABELS: Record<Tab, string> = {
    expenses: t('trip.tabExpenses'),
    balances: t('trip.tabBalances'),
    activity: t('trip.tabActivity'),
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="w-8 h-8 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          <p className="text-gray-500">{t('trip.loading')}</p>
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
            <h1 className="text-2xl font-bold text-gray-800 mb-2">{t('trip.notFound')}</h1>
            <p className="text-gray-500 mb-6">
              {t('trip.notFoundDesc')}
            </p>
            <a href="/" className="text-indigo-600 hover:underline">
              {t('trip.createNew')}
            </a>
          </div>
        </div>
      );
    }
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <p className="text-red-600">{t('trip.failedLoad')}</p>
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
          <div className="flex items-center gap-3">
            <a href="/" className="text-gray-400 hover:text-gray-600" aria-label="Home">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7m-9 9V9m0 0h4m-4 0H7" />
              </svg>
            </a>
            <div>
              <h1 className="text-xl font-bold text-gray-900">{trip.name}</h1>
              <p className="text-sm text-gray-500">{t('trip.members', { count: members.length })}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <LanguageSwitcher />
            <ShareLink tripId={tripId} />
          </div>
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
              className={`flex-1 py-2 text-sm font-medium ${
                activeTab === tab
                  ? 'border-b-2 border-indigo-600 text-indigo-600'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              {TAB_LABELS[tab]}
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
          <div className="space-y-4 pb-24">
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

      {/* FAB: Add Expense */}
      {activeTab === 'expenses' && (
        <button
          onClick={() => setShowAddExpense(true)}
          disabled={!currentMemberId}
          title={!currentMemberId ? t('trip.selectNameFirst') : undefined}
          className="fixed bottom-6 right-6 z-20 flex items-center gap-2 px-5 py-3 bg-indigo-600 text-white font-semibold rounded-full shadow-lg hover:bg-indigo-700 active:scale-95 transition-transform disabled:opacity-40 disabled:cursor-not-allowed"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" />
          </svg>
          {t('trip.addExpense')}
        </button>
      )}

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
