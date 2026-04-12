'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useCreateTrip } from '../hooks/useTrip';
import { SUPPORTED_CURRENCIES } from '../utils/currency';
import { useTripStore } from '../store/tripStore';
import { useLocale, LanguageSwitcher } from '../i18n/LocaleContext';

export default function HomePage() {
  const router = useRouter();
  const { t } = useLocale();
  const [tripName, setTripName] = useState('');
  const [yourName, setYourName] = useState('');
  const [currency, setCurrency] = useState('USD');
  const [error, setError] = useState('');

  const createTrip = useCreateTrip();
  const setCurrentMember = useTripStore((s) => s.setCurrentMember);
  const recentTrips = useTripStore((s) => s.recentTrips);

  // We need a temporary member creation — handled after trip creation
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!tripName.trim() || !yourName.trim()) {
      setError(t('home.fillRequired'));
      return;
    }

    try {
      const { trip } = await createTrip.mutateAsync({
        name: tripName.trim(),
        currency,
      });

      // Add the creator as the first member via API
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/trips/${trip.id}/members`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: yourName.trim() }),
        }
      );
      const data = await res.json();

      // Remember who this user is for this trip
      setCurrentMember(trip.id, data.member.id, data.member.name);

      router.push(`/trips/${trip.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : t('home.failedCreate'));
    }
  };

  return (
    <main className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-br from-blue-50 to-indigo-100">
      <div className="w-full max-w-md">
        {/* Header */}
        <div className="text-center mb-8 relative">
          <div className="absolute right-0 top-0">
            <LanguageSwitcher />
          </div>
          <h1 className="text-4xl font-bold text-indigo-700 mb-2">Trip Tally</h1>
          <p className="text-gray-600">
            {t('home.subtitle')}
          </p>
        </div>

        {/* Card */}
        <div className="bg-white rounded-2xl shadow-lg p-6 sm:p-8">
          <h2 className="text-xl font-semibold text-gray-800 mb-6">{t('home.startNewTrip')}</h2>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                {t('home.tripName')} <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={tripName}
                onChange={(e) => setTripName(e.target.value)}
                placeholder={t('home.tripNamePlaceholder')}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                maxLength={255}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                {t('home.yourName')} <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={yourName}
                onChange={(e) => setYourName(e.target.value)}
                placeholder={t('home.yourNamePlaceholder')}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                maxLength={100}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                {t('home.currency')}
              </label>
              <select
                value={currency}
                onChange={(e) => setCurrency(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
              >
                {SUPPORTED_CURRENCIES.map((c) => (
                  <option key={c.code} value={c.code}>
                    {c.label}
                  </option>
                ))}
              </select>
            </div>

            {error && (
              <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</p>
            )}

            <button
              type="submit"
              disabled={createTrip.isPending}
              className="w-full py-3 bg-indigo-600 text-white font-semibold rounded-lg hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {createTrip.isPending ? t('home.creating') : t('home.createTrip')}
            </button>
          </form>
        </div>

        {recentTrips.length > 0 && (
          <div className="mt-6 bg-white rounded-2xl shadow-lg p-5">
            <h3 className="text-sm font-semibold text-gray-700 mb-3">{t('home.recentTrips')}</h3>
            <ul className="space-y-1">
              {recentTrips.map((t_) => (
                <li key={t_.tripId}>
                  <a
                    href={`/trips/${t_.tripId}`}
                    className="flex items-center justify-between px-3 py-2 rounded-lg hover:bg-indigo-50 text-indigo-700 font-medium text-sm"
                  >
                    {t_.tripName}
                    <svg className="w-4 h-4 text-indigo-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </a>
                </li>
              ))}
            </ul>
          </div>
        )}

        <p className="text-center text-sm text-gray-500 mt-6">
          {t('home.joinTripHint')}
        </p>
      </div>
    </main>
  );
}
