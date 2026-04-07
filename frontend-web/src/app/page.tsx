'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useCreateTrip } from '../hooks/useTrip';
import { useAddMember } from '../hooks/useMembers';
import { SUPPORTED_CURRENCIES } from '../utils/currency';
import { useTripStore } from '../store/tripStore';

export default function HomePage() {
  const router = useRouter();
  const [tripName, setTripName] = useState('');
  const [yourName, setYourName] = useState('');
  const [currency, setCurrency] = useState('USD');
  const [error, setError] = useState('');

  const createTrip = useCreateTrip();
  const setCurrentMember = useTripStore((s) => s.setCurrentMember);

  // We need a temporary member creation — handled after trip creation
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!tripName.trim() || !yourName.trim()) {
      setError('Please fill in all required fields.');
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
      setError(err instanceof Error ? err.message : 'Failed to create trip. Please try again.');
    }
  };

  return (
    <main className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-br from-blue-50 to-indigo-100">
      <div className="w-full max-w-md">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-indigo-700 mb-2">Trip Tally</h1>
          <p className="text-gray-600">
            Track shared expenses with friends. No sign-up needed.
          </p>
        </div>

        {/* Card */}
        <div className="bg-white rounded-2xl shadow-lg p-6 sm:p-8">
          <h2 className="text-xl font-semibold text-gray-800 mb-6">Start a new trip</h2>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Trip name <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={tripName}
                onChange={(e) => setTripName(e.target.value)}
                placeholder="e.g. Tokyo Trip 2025"
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                maxLength={255}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Your name <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={yourName}
                onChange={(e) => setYourName(e.target.value)}
                placeholder="e.g. Alice"
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                maxLength={100}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Currency
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
              {createTrip.isPending ? 'Creating...' : 'Create Trip'}
            </button>
          </form>
        </div>

        <p className="text-center text-sm text-gray-500 mt-6">
          Got a trip link? Paste it in your browser to join.
        </p>
      </div>
    </main>
  );
}
